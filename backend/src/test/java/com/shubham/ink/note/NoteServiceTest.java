package com.shubham.ink.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import com.shubham.ink.common.exception.ResourceNotFoundException;
import com.shubham.ink.common.exception.NoteVersionConflictException;
import com.shubham.ink.note.dto.CreateNoteRequest;
import com.shubham.ink.note.dto.UpdateNoteRequest;
import com.shubham.ink.user.User;
import com.shubham.ink.user.UserRepository;
import com.shubham.ink.user.UserRole;

@ExtendWith(MockitoExtension.class)
class NoteServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private TagRepository tagRepository;

    private NoteService noteService;
    private User user;

    @BeforeEach
    void setUp() {
        noteService = new NoteService(userRepository, noteRepository, tagRepository);
        user = new User("test@example.com", "hash", "Test User", UserRole.USER);
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
    }

    @Test
    void createTrimsFieldsAndNormalizesTags() {
        Tag existingJavaTag = new Tag(user, "java");
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(tagRepository.findAllByUser_IdAndNameIn(eq(user.getId()), any()))
                .thenReturn(List.of(existingJavaTag));
        when(noteRepository.save(any(Note.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = noteService.create(user.getEmail(), new CreateNoteRequest(
                "  Spring transactions  ", "  Content  ",
                Set.of(" Java ", "SPRING", "", "  ")));

        ArgumentCaptor<Note> noteCaptor = ArgumentCaptor.forClass(Note.class);
        verify(noteRepository).save(noteCaptor.capture());
        Note note = noteCaptor.getValue();
        assertThat(note.getTitle()).isEqualTo("Spring transactions");
        assertThat(note.getContent()).isEqualTo("Content");
        assertThat(note.getTags()).extracting(Tag::getName)
                .containsExactlyInAnyOrder("java", "spring");
        assertThat(note.getTags()).contains(existingJavaTag);
        assertThat(response.tags()).containsExactlyInAnyOrder("java", "spring");
    }

    @Test
    void findAllDelegatesPaginationAndMapsResults() {
        Pageable pageable = PageRequest.of(0, 5);
        Note note = note("Page result", "Content");
        note.replaceTags(Set.of(new Tag(user, "java")));
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(
                user.getId(), pageable)).thenReturn(new PageImpl<>(List.of(note), pageable, 8));

        var result = noteService.findAll(user.getEmail(), pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().getFirst().title()).isEqualTo("Page result");
        assertThat(result.getContent().getFirst().tags()).containsExactly("java");
        assertThat(result.getTotalElements()).isEqualTo(8);
        verify(noteRepository).findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(
                user.getId(), pageable);
    }

    @Test
    void findByIdAndUpdateOnlyUseNotesOwnedByCurrentUser() {
        UUID noteId = UUID.randomUUID();
        Note note = note("Old", "Old content");
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findByIdAndUser_Id(noteId, user.getId())).thenReturn(Optional.of(note));
        when(tagRepository.findAllByUser_IdAndNameIn(eq(user.getId()), any())).thenReturn(List.of());

        assertThat(noteService.findById(user.getEmail(), noteId).title()).isEqualTo("Old");

        var updated = noteService.update(user.getEmail(), noteId,
                new UpdateNoteRequest(" New title ", " New content ", Set.of(" Backend "), 0L));

        assertThat(updated.title()).isEqualTo("New title");
        assertThat(updated.content()).isEqualTo("New content");
        assertThat(updated.tags()).containsExactly("backend");
        verify(noteRepository, never()).save(note);
    }

    @Test
    void updateRejectsAnOutdatedNoteVersion() {
        UUID noteId = UUID.randomUUID();
        Note note = note("Current title", "Current content");
        ReflectionTestUtils.setField(note, "version", 3L);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findByIdAndUser_Id(noteId, user.getId())).thenReturn(Optional.of(note));

        assertThatThrownBy(() -> noteService.update(user.getEmail(), noteId,
                new UpdateNoteRequest("Stale title", "Stale content", Set.of(), 2L)))
                .isInstanceOf(NoteVersionConflictException.class)
                .hasMessageContaining("newer version");

        assertThat(note.getTitle()).isEqualTo("Current title");
        assertThat(note.getContent()).isEqualTo("Current content");
        verify(noteRepository, never()).save(any());
    }

    @Test
    void deleteRemovesOwnedNote() {
        UUID noteId = UUID.randomUUID();
        Note note = note("Delete me", "Content");
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findByIdAndUser_Id(noteId, user.getId())).thenReturn(Optional.of(note));

        noteService.delete(user.getEmail(), noteId);

        verify(noteRepository).delete(note);
    }

    @Test
    void archiveUnarchivePinAndUnpinChangeEntityStateWithoutExplicitSave() {
        UUID noteId = UUID.randomUUID();
        Note note = note("Stateful note", "Content");
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findByIdAndUser_Id(noteId, user.getId())).thenReturn(Optional.of(note));

        assertThat(noteService.archive(user.getEmail(), noteId).archived()).isTrue();
        assertThat(noteService.unarchive(user.getEmail(), noteId).archived()).isFalse();
        assertThat(noteService.pin(user.getEmail(), noteId).pinned()).isTrue();
        assertThat(noteService.unpin(user.getEmail(), noteId).pinned()).isFalse();

        verify(noteRepository, never()).save(any());
    }

    @Test
    void findArchivedUsesArchivedQueryAndPagination() {
        Pageable pageable = PageRequest.of(0, 10);
        Note archived = note("Archived", "Content");
        archived.archive();
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findAllByUser_IdAndArchivedTrueOrderByUpdatedAtDesc(user.getId(), pageable))
                .thenReturn(new PageImpl<>(List.of(archived), pageable, 1));

        var result = noteService.findArchived(user.getEmail(), pageable);

        assertThat(result.getContent()).singleElement().satisfies(note -> {
            assertThat(note.title()).isEqualTo("Archived");
            assertThat(note.archived()).isTrue();
        });
    }

    @Test
    void searchTrimsQueryAndPreservesPagination() {
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.searchActiveNotes(user.getId(), "spring", pageable))
                .thenReturn(new PageImpl<>(List.of(note("Spring", "Transactions")), pageable, 1));

        var result = noteService.search(user.getEmail(), "  spring  ", pageable);

        assertThat(result.getContent()).extracting(note -> note.title()).containsExactly("Spring");
        verify(noteRepository).searchActiveNotes(user.getId(), "spring", pageable);
    }

    @Test
    void blankSearchReturnsEmptyPageWithoutQueryingNotes() {
        Pageable pageable = PageRequest.of(0, 20);
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));

        var result = noteService.search(user.getEmail(), "   ", pageable);

        assertThat(result).isEmpty();
        verify(noteRepository, never()).searchActiveNotes(any(), any(), any());
    }

    @Test
    void missingUserOrNoteReturnsNotFound() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.findAll("missing@example.com", PageRequest.of(0, 10)))
                .isInstanceOf(ResourceNotFoundException.class);

        UUID noteId = UUID.randomUUID();
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(noteRepository.findByIdAndUser_Id(noteId, user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> noteService.findById(user.getEmail(), noteId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Note not found");
    }

    private Note note(String title, String content) {
        Note note = new Note(user, title, content);
        ReflectionTestUtils.setField(note, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(note, "version", 0L);
        return note;
    }
}
