package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "occupancies")
@Getter
@Setter
@NoArgsConstructor
public class OccupancyEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(nullable = false, length = 32)
    private String kind; // session, booking, hold, maintenance, convert

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    @Column(name = "convert_group_id")
    private UUID convertGroupId;

    @Column(columnDefinition = "TEXT")
    private String reason;
}
