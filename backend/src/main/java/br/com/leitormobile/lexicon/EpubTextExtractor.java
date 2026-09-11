package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Component
public class EpubTextExtractor {

    private static final Pattern SENTENCE_PATTERN = Pattern.compile("[^.!?]+[.!?]+|[^.!?]+$", Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern TOKEN_PATTERN = Pattern.compile("\\p{L}+(?:[’'\\-]\\p{L}+)*", Pattern.UNICODE_CHARACTER_CLASS);

    public ExtractedBook extract(Book book) throws IOException {
        if (book.getFileUri() == null || book.getFileUri().isBlank()) throw new IOException("O EPUB ainda não está armazenado no backend.");
        Path file = Path.of(book.getFileUri()).toAbsolutePath().normalize();
        if (!Files.isRegularFile(file)) throw new IOException("O arquivo EPUB do livro não foi encontrado.");

        try (ZipFile zip = new ZipFile(file.toFile(), StandardCharsets.UTF_8)) {
            String opfPath = readOpfPath(zip);
            Document opf = parseXml(readEntry(zip, opfPath));
            Map<String, String> manifest = new HashMap<>();
            NodeList items = opf.getElementsByTagNameNS("*", "item");
            if (items.getLength() == 0) items = opf.getElementsByTagName("item");
            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                String id = item.getAttribute("id");
                String href = item.getAttribute("href");
                String mediaType = item.getAttribute("media-type");
                if (!id.isBlank() && !href.isBlank() && (mediaType.contains("html") || mediaType.contains("xhtml"))) {
                    manifest.put(id, resolveZipPath(opfPath, href));
                }
            }
            NodeList refs = opf.getElementsByTagNameNS("*", "itemref");
            if (refs.getLength() == 0) refs = opf.getElementsByTagName("itemref");
            List<ExtractedUnit> units = new ArrayList<>();
            for (int i = 0; i < refs.getLength(); i++) {
                Element ref = (Element) refs.item(i);
                String href = manifest.get(ref.getAttribute("idref"));
                if (href == null) continue;
                String text = extractText(readEntry(zip, href));
                if (text.isBlank()) continue;
                List<ExtractedSentence> sentences = splitSentences(text);
                units.add(new ExtractedUnit(i, href, titleFor(text, href), text, sentences));
            }
            return new ExtractedBook(units);
        }
    }

    private static String readOpfPath(ZipFile zip) throws IOException {
        Document container = parseXml(readEntry(zip, "META-INF/container.xml"));
        NodeList rootfiles = container.getElementsByTagNameNS("*", "rootfile");
        if (rootfiles.getLength() == 0) rootfiles = container.getElementsByTagName("rootfile");
        if (rootfiles.getLength() == 0) throw new IOException("O EPUB não informa o pacote OPF.");
        String path = ((Element) rootfiles.item(0)).getAttribute("full-path");
        return normalizeZipPath(path);
    }

    private static byte[] readEntry(ZipFile zip, String path) throws IOException {
        ZipEntry entry = zip.getEntry(normalizeZipPath(path));
        if (entry == null || entry.isDirectory()) throw new IOException("Arquivo EPUB ausente: " + path);
        if (entry.getSize() > 20L * 1024L * 1024L) throw new IOException("Documento EPUB excede o limite de processamento.");
        try (InputStream stream = zip.getInputStream(entry)) { return stream.readAllBytes(); }
    }

    private static Document parseXml(byte[] bytes) throws IOException {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            return factory.newDocumentBuilder().parse(new InputSource(new java.io.ByteArrayInputStream(bytes)));
        } catch (Exception exception) {
            throw new IOException("O XML interno do EPUB é inválido.", exception);
        }
    }

    private static String extractText(byte[] bytes) throws IOException {
        try {
            Document document = parseXml(bytes);
            removeElements(document, "script");
            removeElements(document, "style");
            return normalizeWhitespace(document.getDocumentElement().getTextContent());
        } catch (IOException exception) {
            String raw = new String(bytes, StandardCharsets.UTF_8);
            return normalizeWhitespace(raw.replaceAll("(?s)<[^>]*>", " "));
        }
    }

    private static void removeElements(Document document, String name) {
        NodeList nodes = document.getElementsByTagNameNS("*", name);
        for (int i = nodes.getLength() - 1; i >= 0; i--) {
            Node node = nodes.item(i);
            if (node.getParentNode() != null) node.getParentNode().removeChild(node);
        }
    }

    private static String titleFor(String text, String href) {
        String firstLine = text.lines().map(String::trim).filter(line -> !line.isBlank()).findFirst().orElse("");
        return firstLine.length() > 200 ? firstLine.substring(0, 200) : (firstLine.isBlank() ? href : firstLine);
    }

    private static List<ExtractedSentence> splitSentences(String text) {
        List<ExtractedSentence> result = new ArrayList<>();
        Matcher matcher = SENTENCE_PATTERN.matcher(text);
        while (matcher.find()) {
            String sentence = normalizeWhitespace(matcher.group());
            if (sentence.isBlank()) continue;
            int start = text.indexOf(matcher.group().stripLeading(), matcher.start());
            int end = Math.min(text.length(), start + matcher.group().strip().length());
            result.add(new ExtractedSentence(result.size(), sentence, start, end, tokenize(sentence, start)));
        }
        return result;
    }

    private static List<ExtractedToken> tokenize(String sentence, int sentenceStart) {
        List<ExtractedToken> result = new ArrayList<>();
        Matcher matcher = TOKEN_PATTERN.matcher(sentence);
        while (matcher.find()) {
            String surface = matcher.group();
            result.add(new ExtractedToken(surface, sentenceStart + matcher.start(), sentenceStart + matcher.end()));
        }
        return result;
    }

    private static String normalizeWhitespace(String value) {
        return value.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
    }

    private static String resolveZipPath(String opfPath, String href) {
        String cleanHref = href.split("#", 2)[0].replace('\\', '/');
        String base = opfPath.contains("/") ? opfPath.substring(0, opfPath.lastIndexOf('/')) : "";
        return normalizeZipPath(base.isBlank() ? cleanHref : base + "/" + cleanHref);
    }

    private static String normalizeZipPath(String value) {
        String path = value == null ? "" : value.replace('\\', '/');
        if (path.startsWith("/") || path.contains("../") || path.equals("..")) throw new IllegalArgumentException("Caminho EPUB inseguro.");
        String normalized = java.nio.file.Paths.get(path).normalize().toString().replace('\\', '/');
        if (normalized.equals(".") || normalized.startsWith("../")) throw new IllegalArgumentException("Caminho EPUB inseguro.");
        return normalized;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    public record ExtractedBook(List<ExtractedUnit> units) {}
    public record ExtractedUnit(int index, String href, String title, String text, List<ExtractedSentence> sentences) {
        public String textHash() { return sha256(text); }
    }
    public record ExtractedSentence(int index, String text, int startOffset, int endOffset, List<ExtractedToken> tokens) {
        public String textHash() { return sha256(text); }
    }
    public record ExtractedToken(String surface, int startOffset, int endOffset) {}
}
