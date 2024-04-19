package org.example.teamspark.model.channel;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.example.teamspark.model.workspace.WorkspaceMember;

import java.io.Serializable;
import java.util.Date;

@Entity
@Table(name = "channel_member")
@Data
@NoArgsConstructor
@IdClass(ChannelMember.ChannelMemberId.class)
public class ChannelMember implements Serializable {

    @Id
    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private WorkspaceMember member;

    @Id
    @ManyToOne
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @Column(name = "joined_at")
    private Date joined_at;

    @NoArgsConstructor
    @Data
    public static class ChannelMemberId implements Serializable {
        private Long member;
        private Long channel;
    }
}