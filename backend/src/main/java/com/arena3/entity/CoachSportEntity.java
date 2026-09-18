package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Entity
@Table(name = "coach_sports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(CoachSportEntity.CoachSportId.class)
public class CoachSportEntity {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(length = 32)
    private String sport;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CoachSportId implements Serializable {
        private UUID userId;
        private String sport;
    }
}
