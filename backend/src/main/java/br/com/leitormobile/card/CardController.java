package br.com.leitormobile.card;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cards")
public class CardController {

    private final CardService service;

    public CardController(CardService service) {
        this.service = service;
    }

    @GetMapping
    public List<CardDtos.Response> list(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.list(includeArchived);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CardDtos.Response create(@Valid @RequestBody CardDtos.CreateRequest request) {
        return service.create(request);
    }

    @PatchMapping("/{id}")
    public CardDtos.Response update(@PathVariable UUID id, @Valid @RequestBody CardDtos.UpdateRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/archive")
    public CardDtos.Response archive(@PathVariable UUID id) {
        return service.archive(id);
    }

    @PostMapping("/{id}/unarchive")
    public CardDtos.Response unarchive(@PathVariable UUID id) {
        return service.unarchive(id);
    }

    @PostMapping("/{id}/move-to-end")
    public CardDtos.Response moveToEnd(@PathVariable UUID id) {
        return service.moveToEnd(id);
    }
}
