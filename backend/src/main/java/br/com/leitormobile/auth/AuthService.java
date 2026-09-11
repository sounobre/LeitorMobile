package br.com.leitormobile.auth;

import br.com.leitormobile.book.Book;
import br.com.leitormobile.book.BookRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppUserRepository userRepository;
    private final SessionTokenRepository tokenRepository;
    private final BookRepository bookRepository;
    private final PasswordEncoder passwordEncoder;
    private final String defaultEmail;
    private final String defaultPassword;

    public AuthService(
            AppUserRepository userRepository,
            SessionTokenRepository tokenRepository,
            BookRepository bookRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.auth.email}") String defaultEmail,
            @Value("${app.auth.password}") String defaultPassword
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.bookRepository = bookRepository;
        this.passwordEncoder = passwordEncoder;
        this.defaultEmail = defaultEmail;
        this.defaultPassword = defaultPassword;
    }

    @Transactional
    public AppUser ensureDefaultAccount() {
        AppUser user = userRepository.findByEmailIgnoreCase(defaultEmail.trim()).orElseGet(
                () -> userRepository.save(new AppUser(
                        defaultEmail.trim().toLowerCase(), passwordEncoder.encode(defaultPassword)
                ))
        );
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(defaultPassword));
        }
        Set<String> ownedHashes = new HashSet<>();
        for (Book book : bookRepository.findLibrary(user.getId())) {
            ownedHashes.add(book.getFileHash());
        }
        for (Book book : bookRepository.findByOwnerIsNull()) {
            if (ownedHashes.add(book.getFileHash())) {
                book.setOwner(user);
            }
        }
        return user;
    }

    @Transactional
    public AuthDtos.LoginResponse login(AuthDtos.LoginRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .orElseThrow(this::invalidCredentials);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokenRepository.save(new SessionToken(hash(token), user, Instant.now().plus(30, ChronoUnit.DAYS)));
        return new AuthDtos.LoginResponse(token, AuthDtos.UserResponse.from(user));
    }

    @Transactional(readOnly = true)
    public AppUser findByToken(String token) {
        if (token == null || token.isBlank()) return null;
        return tokenRepository.findByTokenHashAndExpiresAtAfter(hash(token), Instant.now())
                .map(SessionToken::getUser)
                .orElse(null);
    }

    public AuthDtos.UserResponse me(AppUser user) {
        return AuthDtos.UserResponse.from(user);
    }

    private ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos.");
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não disponível.", exception);
        }
    }
}
