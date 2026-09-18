package com.arena3.repository;

import com.arena3.entity.OutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboxRepository extends JpaRepository<OutboxEntity, UUID> {
    List<OutboxEntity> findByUserIdAndChannelAndSentAtIsNotNull(UUID userId, String channel);
}
