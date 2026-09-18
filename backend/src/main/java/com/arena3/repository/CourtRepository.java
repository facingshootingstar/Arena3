package com.arena3.repository;

import com.arena3.entity.CourtEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourtRepository extends JpaRepository<CourtEntity, UUID> {
    Optional<CourtEntity> findByCourtCode(String courtCode);
    List<CourtEntity> findBySport(String sport);
}
