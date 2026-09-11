package br.com.leitormobile.auth;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    private final AppUserRepository repository;

    public CurrentUserService(AppUserRepository repository) {
        this.repository = repository;
    }

    public AppUser require() {
        Object principal = SecurityContextHolder.getContext().getAuthentication() == null
                ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof String value) {
            try {
                return repository.findById(UUID.fromString(value))
                        .orElseThrow(this::unauthorized);
            } catch (IllegalArgumentException ignored) {
                // Continua para a resposta uniforme de sessão inválida.
            }
        }
        throw unauthorized();
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sessão não autenticada.");
    }
}