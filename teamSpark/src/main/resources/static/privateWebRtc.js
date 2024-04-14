// const LOCAL_IP_ADDRESS = "zackawesome.net";
const LOCAL_IP_ADDRESS = "localhost:8000";

const getElement = id => document.getElementById(id);
const [btnConnect, btnToggleVideo, btnToggleAudio, divRoomConfig,
    roomDiv, roomNameInput, localVideo, remoteVideo] =
    ["btnConnect", "toggleVideo", "toggleAudio", "roomConfig", "roomDiv", "roomName",
        "localVideo", "remoteVideo"].map(getElement);
let remoteDescriptionPromise, roomName, localStream, remoteStream,
    rtcPeerConnection, isCaller;

// you can use public stun and turn servers,
// but we don't need for local development
const iceServers = {
    iceServers: [
        {urls: 'stun:stun.l.google.com:19302'},
        {urls: 'stun:stun1.l.google.com:19302'},
        {urls: 'stun:stun2.l.google.com:19302'},
        {urls: 'stun:stun3.l.google.com:19302'},
        {urls: 'stun:stun4.l.google.com:19302'},
        {
            urls: `turn:13.250.13.83:3478`,
            username: "YzYNCouZM1mhqhmseWk6",
            credential: "YzYNCouZM1mhqhmseWk6"
        }
    ]
};

const streamConstraints = {audio: true, video: true};

// let socket = io.connect(`https://${LOCAL_IP_ADDRESS}`, {secure: true});
let socket = io.connect("http://" + LOCAL_IP_ADDRESS);

btnToggleVideo.addEventListener("click", () => toggleTrack("video"));
btnToggleAudio.addEventListener("click", () => toggleTrack("audio"));

$('#btnLeave').click(() => {
    console.log("leave room")
    socket.emit("leaveRoom", roomName)
    socket.disconnect();
});

function toggleTrack(trackType) {
    if (!localStream) {
        return;
    }

    const track = trackType === "video" ? localStream.getVideoTracks()[0]
        : localStream.getAudioTracks()[0];
    const enabled = !track.enabled;
    track.enabled = enabled;

    const toggleButton = getElement(
        `toggle${trackType.charAt(0).toUpperCase() + trackType.slice(1)}`);
    const icon = getElement(`${trackType}Icon`);
    toggleButton.classList.toggle("disabled-style", !enabled);
    toggleButton.classList.toggle("enabled-style", enabled);
    icon.classList.toggle("bi-camera-video-fill",
        trackType === "video" && enabled);
    icon.classList.toggle("bi-camera-video-off-fill",
        trackType === "video" && !enabled);
    icon.classList.toggle("bi-mic-fill", trackType === "audio" && enabled);
    icon.classList.toggle("bi-mic-mute-fill", trackType === "audio" && !enabled);
}

btnConnect.onclick = () => {
    if (roomNameInput.value === "") {
        alert("Room can not be null!");
    } else {
        roomName = roomNameInput.value;
        socket.emit("joinRoom", roomName);
        divRoomConfig.classList.add("d-none");
        roomDiv.classList.remove("d-none");
    }
};

const handleSocketEvent = (eventName, callback) => socket.on(eventName,
    callback);

handleSocketEvent("created", e => {
    console.log("receive created event")

    navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        isCaller = true;
    }).catch(console.error);
    console.log(socket.id)
});

handleSocketEvent("joined", e => {
    console.log("receive joined event")

    navigator.mediaDevices.getUserMedia(streamConstraints).then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        socket.emit("ready", roomName);
    }).catch(console.error);
});

handleSocketEvent("candidate", e => {
    console.log("receive candidate event");

    if (rtcPeerConnection) {
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: e.label, candidate: e.candidate,
        });

        rtcPeerConnection.onicecandidateerror = (error) => {
            console.error("Error adding ICE candidate: ", error);
        };

        if (remoteDescriptionPromise) {
            remoteDescriptionPromise
                .then(() => {
                    if (candidate != null) {
                        return rtcPeerConnection.addIceCandidate(candidate);
                    }
                })
                .catch(error => console.log(
                    "Error adding ICE candidate after remote description: ", error));
        }
    }
});

handleSocketEvent("ready", joinedClient => {
    console.log("receive ready event");

    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
        rtcPeerConnection
            .createOffer()
            .then(sessionDescription => {
                rtcPeerConnection.setLocalDescription(sessionDescription);
                socket.emit("offer", {
                    type: "offer", sdp: sessionDescription, room: roomName,
                });
            })
            .catch(error => console.log(error));
    }
});

handleSocketEvent("offer", e => {
    console.log("receive offer event");

    if (!isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.ontrack = onAddStream;
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);

        if (rtcPeerConnection.signalingState === "stable") {
            remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
                new RTCSessionDescription(e));
            remoteDescriptionPromise
                .then(() => {
                    return rtcPeerConnection.createAnswer();
                })
                .then(sessionDescription => {
                    rtcPeerConnection.setLocalDescription(sessionDescription);
                    socket.emit("answer", {
                        type: "answer", sdp: sessionDescription, room: roomName,
                    });
                })
                .catch(error => console.log(error));
        }
    }
});

handleSocketEvent("answer", e => {
    console.log("receive answer event");

    if (isCaller && rtcPeerConnection.signalingState === "have-local-offer") {
        remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
            new RTCSessionDescription(e));
        remoteDescriptionPromise.catch(error => console.log(error));
    }
});

handleSocketEvent("userDisconnected", (e) => {
    remoteVideo.srcObject = null;
    isCaller = true;
});

handleSocketEvent("setCaller", callerId => {
    isCaller = socket.id === callerId;
});

handleSocketEvent("full", e => {
    alert("room is full!");
    window.location.reload();
});

const onIceCandidate = e => {
    if (e.candidate) {
        console.log("sending ice candidate");
        socket.emit("candidate", {
            type: "candidate",
            label: e.candidate.sdpMLineIndex,
            id: e.candidate.sdpMid,
            candidate: e.candidate.candidate,
            room: roomName,
        });
    }
}

const onAddStream = e => {
    console.log("Remote stream added")
    remoteVideo.srcObject = e.streams[0];
    remoteStream = e.stream;
}