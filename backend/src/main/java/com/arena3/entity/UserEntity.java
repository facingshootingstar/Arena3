package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "member_code", unique = true, length = 16)
    private String memberCode;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @Column(name = "name_normalized", nullable = false, length = 120)
    private String nameNormalized;

    @Column(nullable = false, unique = true, length = 16)
    private String phone;

    @Column(unique = true, length = 190)
    private String email;

    @Column(nullable = false, length = 32)
    private String role; // manager, coach, receptionist, member

    @Column(nullable = false, length = 32)
    private String status = "active"; // active, locked, disabled

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    @Column(name = "failed_logins", nullable = false)
    private int failedLogins = 0;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "guardian_name", length = 120)
    private String guardianName;

    @Column(name = "guardian_phone", length = 16)
    private String guardianPhone;

    @Column(name = "national_id", length = 20)
    private String nationalId;

    @Column(name = "pii_consent_at")
    private OffsetDateTime piiConsentAt;

    @Column(name = "health_notes", columnDefinition = "TEXT")
    private String healthNotes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
