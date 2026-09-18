package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "training_plans")
@Getter
@Setter
@NoArgsConstructor
public class TrainingPlanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 16)
    private String scope; // class, member

    @Column(name = "class_id")
    private UUID classId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 8)
    private String source = "coach"; // coach, gemini

    @Column(nullable = false)
    private boolean published = false;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;
}
