const localVideo = $('.localVideo')[0];
let remoteDescriptionPromise, localStream, remoteStream;
let roomName = "channel_" + channelInf.channel_id;

// button control
$("#btnToggleVideo").click(() => toggleTrack("Video"));
$("#btnToggleAudio").click(() => toggleTrack("Audio"));

function toggleTrack(trackType) {
    if (!localStream) {
        console.log("localStream is null");
        return;
    }
    const track = trackType === "Video" ? localStream.getVideoTracks()[0]
        : localStream.getAudioTracks()[0];
    const enabled = !track.enabled;
    track.enabled = enabled;

    const toggleButton = $(`#btnToggle${trackType}`);
    const icon = $(`#${trackType}Icon`);
    toggleButton.toggleClass("disabled-style", !enabled);
    toggleButton.toggleClass("enabled-style", enabled);
    icon.toggleClass("bi-camera-video-fill", trackType === "Video" && enabled);
    icon.toggleClass("bi-camera-video-off-fill", trackType === "Video" && !enabled);
    icon.toggleClass("bi-mic-fill", trackType === "Audio" && enabled);
    icon.toggleClass("bi-mic-mute-fill", trackType === "Audio" && !enabled);
}

var $videoCallContent = $(".video-call-content");
var $textMessagingContent = $(".text-messaging-content");

// Function to switch back to text messaging content
function switchToTextMessaging() {
    $textMessagingContent.show();
    $videoCallContent.hide();
}


// Function to adjust the size of video containers
function adjustVideoContainerSize() {
    const videoContainers = $('.video-container');
    const numContainers = videoContainers.length;
    console.log(numContainers);

    // Remove existing size classes
    videoContainers.removeClass('big small');

    // Determine the appropriate class based on the number of containers
    if (numContainers <= 4) {
        videoContainers.addClass('big');
    } else {
        videoContainers.addClass('small');
    }
}

// Function to establish connection to socket server
function connectToSocketServer() {
    // Connect to video call socketIOServer
// const LOCAL_IP_ADDRESS = "zackawesome.net";
// let socket = io.connect(`https://${LOCAL_IP_ADDRESS}`, {secure: true});
    let socket = io.connect("http://localhost:8001");


// Listen for the "connect" event
    socket.on("connect", () => {
        console.log("Connected to Socket.IO server");

        // add name in local stream
        $('.localStream > h3').text("user: " + socket.id);

        // Join room when connect ready
        if (roomName != null) {
            socket.emit("joinRoom", roomName);
        } else {
            alert('channel_id is not properly set!');
        }
    });


    let rtcPeerConnectionsMap = new Map();

// you can use public stun and turn servers,
// but we don't need for local development
    const iceServers = {
        'iceServers': [
            {'urls': 'stun:stun.l.google.com:19302'},
            // {urls: 'stun:stun1.l.google.com:19302'},
            // {urls: 'stun:stun2.l.google.com:19302'},
            // {urls: 'stun:stun3.l.google.com:19302'},
            // {urls: 'stun:stun4.l.google.com:19302'},
            // {
            //     urls: `turn:13.250.13.83:3478`,
            //     username: "YzYNCouZM1mhqhmseWk6",
            //     credential: "YzYNCouZM1mhqhmseWk6"
            // }
        ]
    };

    const streamConstraints = {audio: true, video: true};


// Handle Event
    const handleSocketEvent = (eventName, callback) => socket.on(eventName,
        callback);

    handleSocketEvent("created", async function () {
        console.log("receive created event")
        const stream = await navigator.mediaDevices.getUserMedia(streamConstraints)
        localStream = stream;
        localVideo.srcObject = stream;
    });

    handleSocketEvent("joined", async function (e) {
        console.log("receive joined event")

        // get local stream
        const stream = await navigator.mediaDevices.getUserMedia(streamConstraints)
        localStream = stream;
        localVideo.srcObject = stream;

        console.log(socket.id);
        // loop through existing clients to send offer
        for (let existingClientId of e) {
            if (existingClientId !== socket.id) {
                rtcPeerConnection = new RTCPeerConnection(iceServers);
                rtcPeerConnection.onicecandidate = event => onIceCandidate(event, existingClientId);
                rtcPeerConnection.ontrack = event => onAddStream(event, existingClientId);
                rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
                rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);
                const sessionDescription = await rtcPeerConnection.createOffer();
                await rtcPeerConnection.setLocalDescription(sessionDescription);

                console.log("send offer to existing client: " + existingClientId)

                // send offer event to new client through signal server
                socket.emit("offer", {
                    type: "offer", sdp: sessionDescription, room: roomName,
                    targetClientId: existingClientId,
                });

                // save connection into map for management
                rtcPeerConnectionsMap.set(existingClientId, rtcPeerConnection);
            }
        }
    });


    handleSocketEvent("candidate", e => {
        console.log("receive candidate event");
        console.log("test: " + e.candidateClientId);
        rtcPeerConnection = rtcPeerConnectionsMap.get(e.candidateClientId);
        if (rtcPeerConnection) {
            const candidate = new RTCIceCandidate({
                sdpMLineIndex: e.label, candidate: e.candidate,
            });

            rtcPeerConnection.onicecandidateerror = (error) => {
                // console.error("Error adding ICE candidate: ", error);
            };

            if (remoteDescriptionPromise) {
                remoteDescriptionPromise
                    .then(() => {
                        if (candidate != null) {
                            return rtcPeerConnection.addIceCandidate(candidate);
                        }
                    })
                    .catch(error =>
                            console.log()
                        // console.log("Error adding ICE candidate after remote description: ", error)
                    );
            }
        }
    });

    handleSocketEvent("offer", e => {
        console.log("receive offer event");

        const {offerClientId, sdp} = e;

        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = event => onIceCandidate(event, offerClientId);
        rtcPeerConnection.ontrack = event => onAddStream(event, offerClientId);
        rtcPeerConnection.addTrack(localStream.getTracks()[0], localStream);
        rtcPeerConnection.addTrack(localStream.getTracks()[1], localStream);

        if (rtcPeerConnection.signalingState === "stable") {
            remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
                new RTCSessionDescription(sdp));
            remoteDescriptionPromise
                .then(() => {
                    return rtcPeerConnection.createAnswer();
                })
                .then(sessionDescription => {
                    rtcPeerConnection.setLocalDescription(sessionDescription);
                    socket.emit("answer", {
                        type: "answer", sdp: sessionDescription, room: roomName, offerClientId: offerClientId
                    });

                    console.log("add offerClientId: " + offerClientId + "sdp, and return answer");
                })
                .catch(error => console.log(error));
        }
        // save connection into map for management
        rtcPeerConnectionsMap.set(offerClientId, rtcPeerConnection);
        console.log(rtcPeerConnectionsMap);
    });

    handleSocketEvent("answer", e => {
        console.log("receive answer event");

        const {answerClientId, sdp} = e;

        // find the matching rtcPeerConnection by answerClientId
        rtcPeerConnection = rtcPeerConnectionsMap.get(answerClientId);

        if (rtcPeerConnection.signalingState === "have-local-offer") {
            remoteDescriptionPromise = rtcPeerConnection.setRemoteDescription(
                new RTCSessionDescription(sdp));
            console.log("receive and add answer from " + answerClientId)
            remoteDescriptionPromise.catch(error => console.log(error));
        }
    });

    handleSocketEvent("userDisconnected", (clientId) => {
        $(`#remoteVideo_${clientId}`).remove();
        rtcPeerConnectionsMap.delete(clientId);
    });

    const onIceCandidate = (e, clientId) => {
        console.log("onIceCandidate " + clientId)
        if (e.candidate) {
            console.log("sending ice candidate");
            socket.emit("candidate", {
                type: "candidate",
                label: e.candidate.sdpMLineIndex,
                id: e.candidate.sdpMid,
                candidate: e.candidate.candidate,
                room: roomName,
                targetClientId: clientId
            });
        }
    }

    const onAddStream = (e, clientId) => {
        console.log("Create new video screen");
        createRemoteVideoScreen(e.streams[0], clientId);

        remoteStream = e.stream;
    }


    function createRemoteVideoScreen(stream, clientId) {

        const clientIdVideoElement = $(`#remoteVideo_${clientId}`)

        // make sure video doesn't add duplicate
        if (clientIdVideoElement.length === 0) {
            const $videoPanel = $('.video-panel');

            const $participantDiv = $('<div></div>')
                .addClass("video-container")
                .addClass("remoteStream")
                .attr('id', `remoteVideo_${clientId}`);

            const $videoElement = $('<video autoplay muted></video>')
                .addClass("remoteVideo")
                .prop('srcObject', stream);

            const $remoteParticipantHeader = $('<h3></h3>')
                .addClass("text-center")
                .addClass("streamer-name")
                .text(`Participant: ${clientId}`);

            $participantDiv.append($remoteParticipantHeader);
            $participantDiv.append($videoElement);
            $videoPanel.append($participantDiv);

            // adjust width if needed
            adjustVideoContainerSize();
        }
    }

    return socket;
}

// Call the connectToSocketServer function when btn-video-call is clicked
$('.btn-video-call').click(() => {
    console.log("start video call")
    // Establish connection to the socket server
    let socket = connectToSocketServer();

    // Function to disconnect from the socket server when leaving the video call
    function disconnectFromSocketServer() {

        // Disable video track
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.stop();
            }
        }
        // Disable audio track
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.stop();
            }
        }

        console.log("Leaving room");
        socket.emit("leaveRoom", roomName);
        socket.disconnect();

        // remove all remoteStream videos
        $('.remoteStream').remove();
        adjustVideoContainerSize();
        switchToTextMessaging();
    }

    // Bind the disconnectFromSocketServer function to the "beforeunload" event
    $(window).on('beforeunload', disconnectFromSocketServer);

    $('#btnLeave').click(() => {
        disconnectFromSocketServer();
    });
});