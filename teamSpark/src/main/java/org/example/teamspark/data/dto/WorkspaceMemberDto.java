package org.example.teamspark.data.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class WorkspaceMemberDto {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("user")
    private UserDto userDto;

    @JsonProperty("is_creator")
    private boolean isCreator;

    @JsonProperty("roles")
    private List<RoleDto> roles;
}
