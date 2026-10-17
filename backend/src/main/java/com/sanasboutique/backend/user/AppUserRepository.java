package com.sanasboutique.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    Optional<AppUser> findByMobileNo(String mobileNo);

    boolean existsByRole(Role role);

    boolean existsByMobileNo(String mobileNo);

    @Modifying
    @Query("update AppUser u set u.passwordHash = :passwordHash where u.id = :id")
    int updatePassword(@Param("id") Long id, @Param("passwordHash") String passwordHash);

    @Modifying
    @Query(
            "update AppUser u set u.username = :username, u.mobileNo = :mobileNo, u.fullName ="
                + " :fullName where u.id = :id")
    int updateIdentity(
            @Param("id") Long id,
            @Param("username") String username,
            @Param("mobileNo") String mobileNo,
            @Param("fullName") String fullName);

    @Modifying
    @Query("update AppUser u set u.active = :active where u.id = :id")
    int updateActive(@Param("id") Long id, @Param("active") boolean active);
}
