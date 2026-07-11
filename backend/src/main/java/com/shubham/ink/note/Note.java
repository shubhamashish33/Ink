package com.shubham.ink.note;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import com.shubham.ink.user.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "notes")
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "encrypted_payload", columnDefinition = "TEXT")
    private String encryptedPayload;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable =  false)
    private boolean archived = false;

    @Column(nullable = false)
    private boolean pinned = false;

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "note_tags",
        joinColumns = @JoinColumn(name = "note_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new LinkedHashSet<>();

    protected Note() {
    }

    public Note(User user, String encryptedPayload) {
        this.user = user;
        this.encryptedPayload = encryptedPayload;
    }

    public Note(User user, String title, String content) {
        this.user = user;
        this.title = title;
        this.content = content;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getUserId() {
        return user.getId();
    }

    public UUID getId() {
        return id;
    }

    public String getEncryptedPayload() {
        return encryptedPayload;
    }

    public String getTitle() { return title; }
    public String getContent() { return content; }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isArchived() {
        return archived;
    }

    public boolean isPinned() {
        return pinned;
    }

    public Set<Tag> getTags() {
        return tags;
    }
    
    public void archive() {
        this.archived = true;
    }

    public void unarchive() {
        this.archived = false;
    }

    public void pin() {
        this.pinned = true;
    }

    public void unpin() {
        this.pinned = false;
    }

    public void update(String encryptedPayload) {
        this.encryptedPayload = encryptedPayload;
    }

    public void update(String title, String content) { this.title = title; this.content = content; }
    public void replaceTags(Set<Tag> tags) { this.tags.clear(); this.tags.addAll(tags); }

}
