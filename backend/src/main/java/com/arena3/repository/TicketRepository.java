package com.arena3.repository;

import com.arena3.entity.TicketEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<TicketEntity, UUID> {
    List<TicketEntity> findByUserId(UUID userId);
}
