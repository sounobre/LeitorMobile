package br.com.leitormobile.auth;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class DefaultAccountSeeder {

    private final AuthService authService;

    public DefaultAccountSeeder(AuthService authService) {
        this.authService = authService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        authService.ensureDefaultAccount();
    }
}
