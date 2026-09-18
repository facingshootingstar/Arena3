package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "courts")
@Getter
@Setter
@NoArgsConstructor
public class CourtEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "court_code", nullable = false, unique = true, length = 8)
    private String courtCode;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(nullable = false, length = 32)
    private String status = "ready";

    @Column(nullable = false)
    private boolean convertible = false;

    @Column(name = "pair_court_id")
    private UUID pairCourtId;
}
