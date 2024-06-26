package org.example.teamspark.data.dto.message;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class MessageDto {
    @JsonProperty("message_id")
    private MessageId messageId;

    @NotBlank
    @JsonProperty("from_id")
    private Long fromId;

    @NotBlank
    @JsonProperty("from_name")
    private String fromName;

    private String content;

    @JsonProperty("plain_text_content")
    private String plainTextContent;

    @JsonProperty("created_at")
    private Date createdAt = new Date();

    @JsonProperty("contain_link")
    private boolean containLink;

    @JsonProperty("file_url")
    private String fileUrl;

    @JsonProperty("image_url")
    private String imageUrl;
}
