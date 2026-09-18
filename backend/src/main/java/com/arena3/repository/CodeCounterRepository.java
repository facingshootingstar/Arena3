package com.arena3.repository;

import com.arena3.entity.CodeCounterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CodeCounterRepository extends JpaRepository<CodeCounterEntity, CodeCounterEntity.CodeCounterId> {
    Optional<CodeCounterEntity> findByKindAndYyyy(String kind, int yyyy);
}
