// Ensure the DOM is loaded before initializing
window.addEventListener('DOMContentLoaded', async () => {
    const startCallButton = document.getElementById('startCall');

    if (startCallButton) {
        startCallButton.addEventListener('click', async () => {
            const doctorId = startCallButton.getAttribute('data-doctor-id');
            startVideoCall(doctorId);
        });
    }
});

// Function to initiate a video call
async function startVideoCall(doctorId) {
    try {
        // Fetch the Twilio Access Token from the backend
        const response = await fetch(`/api/video/token?doctorId=${doctorId}`);
        const data = await response.json();

        if (!data.token) {
            alert('Error: Unable to get video token');
            return;
        }

        // Connect to the Twilio Video room
        const room = await Twilio.Video.connect(data.token, {
            video: true,
            audio: true,
            name: data.roomName
        });

        console.log(`Connected to Room: ${room.name}`);

        // Display local participant's video
        displayParticipant(room.localParticipant, 'localVideo');

        // Listen for remote participants joining
        room.on('participantConnected', (participant) => {
            console.log(`Participant connected: ${participant.identity}`);
            displayParticipant(participant, 'remoteVideo');
        });

        // Handle participant disconnection
        room.on('participantDisconnected', (participant) => {
            console.log(`Participant disconnected: ${participant.identity}`);
            removeParticipant(participant);
        });

    } catch (error) {
        console.error('Error starting video call:', error);
        alert('Failed to connect to video call. Please try again.');
    }
}

// Display video for a participant
function displayParticipant(participant, containerId) {
    const container = document.getElementById(containerId);

    participant.tracks.forEach((trackPublication) => {
        if (trackPublication.isSubscribed) {
            container.appendChild(trackPublication.track.attach());
        }
    });

    participant.on('trackSubscribed', (track) => {
        container.appendChild(track.attach());
    });

    participant.on('trackUnsubscribed', (track) => {
        track.detach().forEach((el) => el.remove());
    });
}

// Remove a participant's video
function removeParticipant(participant) {
    participant.tracks.forEach((trackPublication) => {
        if (trackPublication.track) {
            trackPublication.track.detach().forEach((el) => el.remove());
        }
    });
}