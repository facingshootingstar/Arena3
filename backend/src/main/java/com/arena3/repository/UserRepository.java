package com.arena3.repository;

import com.arena3.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByPhone(String phone);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByMemberCode(String memberCode);

    @Query("SELECT u FROM UserEntity u WHERE u.phone = :login OR u.email = :login")
    Optional<UserEntity> findByLogin(@Param("login") String login);

    List<UserEntity> findByRole(String role);

    @Query("SELECT u FROM UserEntity u WHERE (:q IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%')) OR u.phone LIKE CONCAT('%', :q, '%') OR LOWER(u.memberCode) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<UserEntity> searchUsers(@Param("q") String q);
}
