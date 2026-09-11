package br.com.leitormobile.auth;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public final class AuthDtos {
    private AuthDtos() {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record UserResponse(UUID id, String email) {
        static UserResponse from(AppUser user) {
            return new UserResponse(user.getId(), user.getEmail());
        }
    }

    public record LoginResponse(String token, UserResponse user) {}
}
