package com.shubham.ink.note;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.shubham.ink.common.exception.ResourceNotFoundException;
import com.shubham.ink.note.dto.CreateNoteRequest;
import com.shubham.ink.note.dto.NoteResponse;
import com.shubham.ink.note.dto.UpdateNoteRequest;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;

@Service
public class NoteService {

    private final UserRepository userRepository;
    private final NoteRepository noteRepository;
    private final TagRepository tagRepository;

    public NoteService(UserRepository userRepository, NoteRepository noteRepository, TagRepository tagRepository) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.tagRepository = tagRepository;
    }

    @Transactional
    public NoteResponse create(String email, CreateNoteRequest request) {

        User user = getUserByEmail(email);

        Note note = new Note(
            user,
            request.title().trim(),
            request.content().trim()
        );
        note.replaceTags(resolveTags(user, request.tags()));

        return toResponse(noteRepository.save(note));
    }

    @Transactional(readOnly = true)
    public Page<NoteResponse> findAll(String email, Pageable pageable) {

        User user = getUserByEmail(email);

        return noteRepository.findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(user.getId(), pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public NoteResponse findById(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        return toResponse(note);
    }

    @Transactional
    public NoteResponse update(String email, UUID noteId, UpdateNoteRequest request) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        note.update(request.title().trim(), request.content().trim());
        note.replaceTags(resolveTags(user, request.tags()));

        return toResponse(note);
    }

    @Transactional
    public void delete(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        noteRepository.delete(note);
    }

    @Transactional
    public NoteResponse archive(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        note.archive();

        return toResponse(note);
    }

    @Transactional
    public NoteResponse unarchive(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        note.unarchive();

        return toResponse(note);
    }


    @Transactional
    public NoteResponse pin(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        note.pin();

        return toResponse(note);
    }

    @Transactional
    public NoteResponse unpin(String email, UUID noteId) {
        User user = getUserByEmail(email);

        Note note = noteRepository.findByIdAndUser_Id(noteId, user.getId()).orElseThrow(() -> new ResourceNotFoundException("Note not found"));

        note.unpin();

        return toResponse(note);
    }

    @Transactional(readOnly = true)
    public Page<NoteResponse> findArchived(String email, Pageable pageable) {
        User user = getUserByEmail(email);

        return noteRepository.findAllByUser_IdAndArchivedTrueOrderByUpdatedAtDesc(user.getId(), pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<NoteResponse> search(String email, String query, Pageable pageable) {
        User user = getUserByEmail(email);

        String normalizedQuery = query == null ? "" : query.trim();

        if (normalizedQuery.isBlank()) {
            return Page.empty(pageable);
        }

        return noteRepository.searchActiveNotes(user.getId(), normalizedQuery, pageable).map(this::toResponse);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException(email));
    }

    private NoteResponse toResponse(Note note) {
        return new NoteResponse(
            note.getId(),
            note.getTitle(),
            note.getContent(),
            note.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new)),
            note.isArchived(),
            note.isPinned(),
            note.getCreatedAt(),
            note.getUpdatedAt()
        );
    }

    private Set<Tag> resolveTags(User user, Set<String> rawTags) {
        Set<String> tagNames = normalizeTags(rawTags);

        if (tagNames.isEmpty()) {
            return Set.of();
        }

        Set<Tag> resolvedTags = new LinkedHashSet<>(tagRepository.findAllByUser_IdAndNameIn(user.getId(), tagNames));
        Set<String> existingNames = resolvedTags.stream().map(Tag::getName).collect(Collectors.toSet());

        tagNames.stream()
            .filter(name -> !existingNames.contains(name))
            .map(name -> new Tag(user, name))
            .forEach(resolvedTags::add);

        return resolvedTags;
    }

    private Set<String> normalizeTags(Set<String> rawTags) {
        if (rawTags == null) {
            return Set.of();
        }

        return rawTags.stream()
            .map(tag -> tag == null ? "" : tag.trim().toLowerCase())
            .filter(tag -> !tag.isBlank())
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
