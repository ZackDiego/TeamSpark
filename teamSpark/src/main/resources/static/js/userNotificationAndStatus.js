(function () {
    let stompClient;
    if (hostName === 'localhost') {
        stompClient = new StompJs.Client({
            brokerURL: 'ws://' + hostName + ':8080/notificationWebsocket'
        });
    } else {
        stompClient = new StompJs.Client({
            brokerURL: 'wss://' + hostName + '/notificationWebsocket'
        });
    }

    const user = JSON.parse(localStorage.getItem('user'));

    stompClient.onConnect = (frame) => {
        console.log('Connected: ' + frame);
        stompClient.subscribe('/userNotification/' + user.id, (result) => {
            console.log("receive notification");
            renderNotification(JSON.parse(result.body));
        });
    };

    stompClient.onWebSocketError = (error) => {
        console.error('Error with websocket', error);
    };

    stompClient.onStompError = (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
    };

    function connect() {
        stompClient.activate();
    }

    function disconnect() {
        if (stompClient !== null) {
            stompClient.deactivate();
        }
        // setConnected(false);
        console.log("Disconnected");
    }

    function renderNotification(data) {
        console.log(data);

        // check if user is not the sender & user is not on the channel
        const currentChannelId = parseInt($('#text-messaging-content').attr('data-channel-id'));

        if (data.message.from_id !== getMemberId() && currentChannelId !== data.channel_id) {
            // Create a temporary element
            var tempElement = document.createElement('div');

            // Set the HTML content of the temporary element to the message
            tempElement.innerHTML = data.message.content;

            // Extract the text content from the temporary element
            const messageText = tempElement.textContent || tempElement.innerText;

            // find from user avatar
            const membersData = JSON.parse(sessionStorage.getItem('workspaceMembers'));
            // Function to find the user object by ID
            const from_user = membersData.find(user => user.id === data.message.from_id)?.user;

            console.log(data.message);
            // Create the toast HTML
            var toastHtml = `
            <div class="toast" role="alert" aria-live="assertive" aria-atomic="true" 
            data-channel-id=${data.channel_id} data-message-id="${data.message.message_id.documentId}">
                <div class="toast-header">
                    <img src=${from_user.avatar} class="avatar rounded mr-2" alt="...">
                    <strong class="mr-auto">${data.message.from_name}</strong> 
                    <small>${new Date(data.message.created_at).toLocaleString()}</small>
                    <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="toast-body">${messageText}</div>
            </div>`;

            $('.toast-container').eq(0).append(toastHtml);

            // remove when close
            $('.toast .close').on('click', function () {
                $(this).closest('.toast').remove();
            });

            // Show the toast
            $(".toast").toast({
                autohide: false
            });
            $('.toast').toast('show');
        }
    }

    $(function () {
        connect();
    });

    $(window).on('beforeunload', function () {
        disconnect();
    });
})();
