package org.example.teamspark.service;

import jakarta.persistence.EntityNotFoundException;
import org.example.teamspark.data.dto.WorkspaceDto;
import org.example.teamspark.data.dto.WorkspaceMemberDto;
import org.example.teamspark.exception.ResourceAccessDeniedException;
import org.example.teamspark.model.user.User;
import org.example.teamspark.model.workspace.Workspace;
import org.example.teamspark.model.workspace.WorkspaceMember;
import org.example.teamspark.repository.UserRepository;
import org.example.teamspark.repository.WorkspaceMemberRepository;
import org.example.teamspark.repository.WorkspaceRepository;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final ModelMapper modelMapper;

    @Autowired
    public WorkspaceService(WorkspaceRepository workspaceRepository, UserRepository userRepository, WorkspaceMemberRepository workspaceMemberRepository, ModelMapper modelMapper) {
        this.workspaceRepository = workspaceRepository;
        this.userRepository = userRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.modelMapper = modelMapper;
    }

    @Transactional
    public WorkspaceDto createWorkspace(User creator, WorkspaceDto dto) {

        Workspace workspace = modelMapper.map(dto, Workspace.class);

        workspace.setCreator(creator);
        workspace.setCreatedAt(new Date());

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        // Create new workspace member to save
        WorkspaceMember newMember = new WorkspaceMember();
        newMember.setWorkspace(workspace);
        newMember.setUser(creator);
        workspaceMemberRepository.save(newMember);

        // Map the members to UserDto objects
        List<WorkspaceMemberDto> memberDtos = workspaceMemberRepository.findUsersByWorkspace(workspace).stream()
                .map(member -> modelMapper.map(member, WorkspaceMemberDto.class))
                .collect(Collectors.toList());

        // Map the savedWorkspace to WorkspaceDto
        WorkspaceDto workspaceDto = modelMapper.map(savedWorkspace, WorkspaceDto.class);

        // Set the members in the workspaceDto
        workspaceDto.setMembers(memberDtos);

        return workspaceDto;
    }

    public List<WorkspaceDto> getUserWorkspacesByUser(User user) {

        List<Workspace> workspaces = workspaceRepository.findByCreator(user);

        return workspaces.stream()
                .map(workspace -> {
                    WorkspaceDto workspaceDto = modelMapper.map(workspace, WorkspaceDto.class);
                    // Retrieve the members of the workspace
                    List<WorkspaceMemberDto> memberDtos = workspaceMemberRepository.findUsersByWorkspace(workspace).stream()
                            .map(member -> modelMapper.map(member, WorkspaceMemberDto.class))
                            .collect(Collectors.toList());
                    // Set the members in the workspaceDto
                    workspaceDto.setMembers(memberDtos);
                    return workspaceDto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateWorkspace(Long id, User user, WorkspaceDto dto) throws ResourceAccessDeniedException {

        Workspace workspace = workspaceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found"));

        // check if user owns the workspace
        if (!workspace.getCreator().getId().equals(user.getId())) {
            throw new ResourceAccessDeniedException("User is unauthorized to modify the workspace");
        }

        // convert members to memberId
        Set<Long> updatedUserIdsSet = dto.getMembers().stream()
                .map(WorkspaceMemberDto::getId)
                .collect(Collectors.toSet());

        // Update members
        updateWorkspaceMembers(workspace, updatedUserIdsSet);

        // Update the fields of the workspace entity
        workspace.setName(dto.getName());
        workspace.setAvatar(dto.getAvatar());

        // Save the updated workspace entity back to the repository
        workspaceRepository.save(workspace);
    }

    public void updateWorkspaceMembers(Workspace workspace, Set<Long> updatedUserIds) {

        // Retrieve existing members
        Set<User> currentMembers = workspaceMemberRepository.findByWorkspace(workspace).stream()
                .map(WorkspaceMember::getUser)
                .collect(Collectors.toSet());

        // Find workspace members to add
        Set<Long> userIdsToAdd = updatedUserIds.stream()
                .filter(userId -> currentMembers.stream()
                        .noneMatch(member -> member.getId().equals(userId)))
                .collect(Collectors.toSet());

        // Find workspace members to remove
        Set<Long> userIdsToRemove = currentMembers.stream()
                .map(User::getId)
                .filter(id -> !updatedUserIds.contains(id))
                .collect(Collectors.toSet());

        // Add new workspace members
        for (Long userId : userIdsToAdd) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new EntityNotFoundException("User not found with ID: " + userId));

            WorkspaceMember newMember = new WorkspaceMember();
            newMember.setWorkspace(workspace);
            newMember.setUser(user);
            workspaceMemberRepository.save(newMember);
        }

        // Remove existing workspace members
        for (Long userId : userIdsToRemove) {
            currentMembers.removeIf(member -> member.getId().equals(userId));
            workspaceMemberRepository.deleteByWorkspaceIdAndUserId(workspace.getId(), userId);
        }
    }

    @Transactional
    public void deleteWorkspace(Long id, User user) throws ResourceAccessDeniedException {

        Workspace workspace = workspaceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found"));

        // check if user owns the workspace
        if (!workspace.getCreator().getId().equals(user.getId())) {
            throw new ResourceAccessDeniedException("User is unauthorized to modify the workspace");
        }

        // Delete associated WorkspaceMember records
        workspaceMemberRepository.deleteByWorkspace(workspace);

        workspaceRepository.deleteById(id);
    }
}
