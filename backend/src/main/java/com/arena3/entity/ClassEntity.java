package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "classes")
@Getter
@Setter
@NoArgsConstructor
public class ClassEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(nullable = false, length = 24)
    private String level;

    @Column(name = "coach_id", nullable = false)
    private UUID coachId;

    @Column(name = "assistant_id")
    private UUID assistantId;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "enrolled_count", nullable = false)
    private int enrolledCount = 0;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rrule;

    @Column(name = "duration_min", nullable = false)
    private int durationMin = 90;

    @Column(name = "start_on", nullable = false)
    private LocalDate startOn;

    @Column(name = "end_on", nullable = false)
    private LocalDate endOn;

    @Column(nullable = false, length = 32)
    private String status = "draft"; // draft, open, closed, cancelled
}
