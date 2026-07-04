package com.shubham.ink.note;

import java.util.List;
import java.util.UUID;

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

    public NoteService(UserRepository userRepository, NoteRepository noteRepository) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public NoteResponse create(String email, CreateNoteRequest request) {

        User user = getUserByEmail(email);

        Note note = new Note(
            user,
            request.title(),
            request.content()
        );

        return toResponse(noteRepository.save(note));
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> findAll(String email) {

        User user = getUserByEmail(email);

        return noteRepository.findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(user.getId()).stream().map(this::toResponse).toList();
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
    public List<NoteResponse> findArchived(String email) {
        User user = getUserByEmail(email);

        return noteRepository.findAllByUser_IdAndArchivedTrueOrderByUpdatedAtDesc(user.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> search(String email, String query) {
        User user = getUserByEmail(email);

        String normalizedQuery = query == null ? "" : query.trim();

        if (normalizedQuery.isBlank()) {
            return List.of();
        }

        return noteRepository.searchActiveNotes(user.getId(), normalizedQuery).stream().map(this::toResponse).toList();
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException(email));
    }

    private NoteResponse toResponse(Note note) {
        return new NoteResponse(
            note.getId(),
            note.getTitle(),
            note.getContent(),
            note.isArchived(),
            note.isPinned(),
            note.getCreatedAt(),
            note.getUpdatedAt()
        );
    }
}
