package com.shubham.ink.note;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.shubham.ink.note.dto.CreateNoteRequest;
import com.shubham.ink.note.dto.NoteResponse;
import com.shubham.ink.note.dto.UpdateNoteRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/notes")
public class NoteController {
    
    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @PostMapping
    public ResponseEntity<NoteResponse> create (
        Authentication authentication, 
        @Valid @RequestBody CreateNoteRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(noteService.create(authentication.getName(), request));
    }

    @GetMapping
    public List<NoteResponse> findAll(Authentication authentication) {
        return noteService.findAll(authentication.getName());
    }

    @GetMapping("/{id}")
    public NoteResponse findbyId(
        Authentication authentication, 
        @PathVariable UUID id
    ) {
        return noteService.findById(authentication.getName(), id);
    }
    
    @PutMapping("/{id}")
    public NoteResponse update(
        Authentication authentication,
        @PathVariable UUID id,
        @Valid @RequestBody UpdateNoteRequest request
    ) {
        return noteService.update(authentication.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        Authentication authentication,
        @PathVariable UUID id
    ) {
        noteService.delete(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

}
