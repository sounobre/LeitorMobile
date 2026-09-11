package br.com.leitormobile.lexicon;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/books/{bookId}/lexicon")
public class LexiconController {
    private final LexiconService service;
    public LexiconController(LexiconService service) { this.service = service; }

    @PostMapping("/jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public LexiconDtos.JobResponse start(@PathVariable UUID bookId,
                                         @RequestParam(defaultValue = "false") boolean force) {
        return service.start(bookId, force);
    }

    @GetMapping("/jobs/latest")
    public LexiconDtos.JobResponse status(@PathVariable UUID bookId) { return service.status(bookId); }

    @GetMapping
    public List<LexiconDtos.EntryResponse> list(@PathVariable UUID bookId,
                                                @RequestParam(defaultValue = "") String search,
                                                @RequestParam(defaultValue = "2000") int limit) {
        return service.list(bookId, search, limit);
    }

    @GetMapping("/lookup")
    public LexiconDtos.EntryResponse lookup(@PathVariable UUID bookId, @RequestParam String term) {
        return service.lookup(bookId, term);
    }
}
