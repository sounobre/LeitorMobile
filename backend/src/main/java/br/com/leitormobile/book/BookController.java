package br.com.leitormobile.book;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService service;
    private final BookContentService contentService;

    public BookController(BookService service, BookContentService contentService) {
        this.service = service;
        this.contentService = contentService;
    }

    @GetMapping
    public List<BookDtos.Response> list(@RequestParam(defaultValue = "") String search) {
        return service.list(search);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookDtos.Response create(@Valid @RequestBody BookDtos.CreateBookRequest request) {
        return service.create(request);
    }

    @PostMapping(value = "/{id}/content", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BookDtos.Response uploadContent(
            @PathVariable UUID id,
            @RequestPart(value = "epub", required = false) MultipartFile epub,
            @RequestPart(value = "cover", required = false) MultipartFile cover
    ) {
        return BookDtos.Response.from(contentService.store(id, epub, cover));
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> file(@PathVariable UUID id) {
        BookContentService.StoredContent content = contentService.open(id, false);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mediaType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + content.filename().replace("\"", "") + "\"")
                .body(content.resource());
    }

    @GetMapping("/{id}/cover")
    public ResponseEntity<Resource> cover(@PathVariable UUID id) {
        BookContentService.StoredContent content = contentService.open(id, true);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mediaType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + content.filename().replace("\"", "") + "\"")
                .body(content.resource());
    }
    @PatchMapping("/{id}/progress")
    public BookDtos.Response updateProgress(@PathVariable UUID id, @Valid @RequestBody BookDtos.ProgressRequest request) {
        return service.updateProgress(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
