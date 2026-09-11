package br.com.leitormobile.book;

import br.com.leitormobile.auth.CurrentUserService;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookContentService {

    private static final long MAX_EPUB_BYTES = 100L * 1024L * 1024L;
    private static final List<String> COVER_EXTENSIONS = List.of(".jpg", ".png", ".webp", ".gif");

    private final BookRepository books;
    private final CurrentUserService currentUser;
    private final Path storageRoot;

    public BookContentService(
            BookRepository books,
            CurrentUserService currentUser,
            @Value("${app.storage-directory:./data/library}") String storageDirectory
    ) {
        this.books = books;
        this.currentUser = currentUser;
        this.storageRoot = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    @Transactional
    public Book store(UUID id, MultipartFile epub, MultipartFile cover) {
        Book book = ownedBook(id);
        if ((epub == null || epub.isEmpty()) && (cover == null || cover.isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie o EPUB ou a capa.");
        }
        try {
            Files.createDirectories(storageRoot.resolve("books"));
            Files.createDirectories(storageRoot.resolve("covers"));
            if (epub != null && !epub.isEmpty()) {
                if (epub.getSize() > MAX_EPUB_BYTES) {
                    throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "O EPUB excede 100 MB.");
                }
                if (!book.getFileHash().startsWith("manual:") && !book.getFileHash().equalsIgnoreCase(sha256(epub))) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O hash do EPUB não corresponde ao livro.");
                }
                Path target = storageRoot.resolve("books").resolve(id + ".epub");
                epub.transferTo(target);
                book.setFileUri(target.toString());
            }
            if (cover != null && !cover.isEmpty()) {
                String extension = extensionFor(cover);
                Path target = storageRoot.resolve("covers").resolve(id + extension);
                cover.transferTo(target);
                book.setCoverUri(target.toString());
            }
            return book;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível armazenar o conteúdo.", exception);
        }
    }

    @Transactional(readOnly = true)
    public StoredContent open(UUID id, boolean cover) {
        Book book = ownedBook(id);
        String storedPath = cover ? book.getCoverUri() : book.getFileUri();
        if (storedPath == null || storedPath.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, cover ? "Capa não encontrada." : "EPUB não encontrado.");
        }
        Path path = Path.of(storedPath).toAbsolutePath().normalize();
        if (!path.startsWith(storageRoot) || !Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, cover ? "Capa não encontrada." : "EPUB não encontrado.");
        }
        String filename = cover ? book.getOriginalName().replaceFirst("(?i)\\.epub$", ".jpg") : book.getOriginalName();
        String mediaType = cover ? contentType(path, "image/jpeg") : "application/epub+zip";
        return new StoredContent(new FileSystemResource(path), filename, mediaType);
    }

    void deleteStoredContent(UUID id, Book book) {
        List<Path> paths = new ArrayList<>();
        Path booksDirectory = storageRoot.resolve("books").toAbsolutePath().normalize();
        Path coversDirectory = storageRoot.resolve("covers").toAbsolutePath().normalize();

        addManagedPath(paths, book.getFileUri(), booksDirectory, id + ".", id + ".epub");
        addManagedPath(paths, book.getCoverUri(), coversDirectory, id + ".", null);
        addManagedPath(paths, booksDirectory.resolve(id + ".epub").toString(), booksDirectory, id + ".", id + ".epub");
        for (String extension : COVER_EXTENSIONS) {
            addManagedPath(paths, coversDirectory.resolve(id + extension).toString(), coversDirectory, id + ".", id + extension);
        }

        IOException failure = null;
        for (Path path : paths.stream().distinct().toList()) {
            try {
                if (Files.isDirectory(path)) {
                    throw new IOException("O caminho armazenado é um diretório: " + path);
                }
                Files.deleteIfExists(path);
            } catch (IOException exception) {
                if (failure == null) failure = exception;
            }
        }
        if (failure != null) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Não foi possível remover os arquivos do livro.",
                    failure
            );
        }
    }

    private void addManagedPath(
            List<Path> paths,
            String storedPath,
            Path expectedDirectory,
            String expectedPrefix,
            String expectedFilename
    ) {
        if (storedPath == null || storedPath.isBlank()) return;
        Path path = Path.of(storedPath).toAbsolutePath().normalize();
        String filename = path.getFileName().toString();
        if (!path.startsWith(storageRoot)
                || !path.getParent().equals(expectedDirectory)
                || !filename.startsWith(expectedPrefix)
                || (expectedFilename != null && !filename.equals(expectedFilename))
                || (expectedFilename == null && !isKnownCover(filename))) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "O conteúdo armazenado do livro está fora do diretório permitido."
            );
        }
        paths.add(path);
    }

    private boolean isKnownCover(String filename) {
        return COVER_EXTENSIONS.stream().anyMatch(filename::endsWith);
    }

    private Book ownedBook(UUID id) {
        return books.findByIdAndOwnerId(id, currentUser.require().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Livro não encontrado."));
    }

    private static String sha256(MultipartFile file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = file.getInputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível.", exception);
        }
    }

    private static String extensionFor(MultipartFile file) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (name.endsWith(".png") || "image/png".equalsIgnoreCase(file.getContentType())) return ".png";
        if (name.endsWith(".webp") || "image/webp".equalsIgnoreCase(file.getContentType())) return ".webp";
        if (name.endsWith(".gif") || "image/gif".equalsIgnoreCase(file.getContentType())) return ".gif";
        return ".jpg";
    }

    private static String contentType(Path path, String fallback) {
        try {
            String type = Files.probeContentType(path);
            return type == null ? fallback : type;
        } catch (IOException ignored) {
            return fallback;
        }
    }

    public record StoredContent(Resource resource, String filename, String mediaType) {}
}
