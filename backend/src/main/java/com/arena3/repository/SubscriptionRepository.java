package com.arena3.repository;

import com.arena3.entity.SubscriptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<SubscriptionEntity, UUID> {
    List<SubscriptionEntity> findByUserId(UUID userId);
    List<SubscriptionEntity> findByUserIdAndStatus(UUID userId, String status);
}
