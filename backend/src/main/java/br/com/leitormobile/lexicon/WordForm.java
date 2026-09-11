package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "word_forms", uniqueConstraints = @UniqueConstraint(columnNames = {"lexeme_id", "form"}))
public class WordForm {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lexeme_id", nullable = false) private Lexeme lexeme;
    @Column(nullable = false, length = 500) private String form;
    protected WordForm() {}
    public WordForm(Lexeme lexeme, String form) { this.lexeme = lexeme; this.form = form; }
}
