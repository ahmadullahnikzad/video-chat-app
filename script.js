const localVideo=document.getElementById('localVideo')
const remoteVideo=document.getElementById('remoteVideo')
//Generate radom room name if needed
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}

const roomHash = location.hash.substring(1);
const configuration = {
    iceServers: [{
        urls: 'stun:stun.l.google.com:19302'//Google's public stun server
    }]
}


function onSuccess() { }
function onError(error) {
    console.error(error)
}
const drone = new ScaleDrone('dRAQbaa5amaZrrIH');
const roomName = 'observable-' + roomHash;
let room;

drone.on('open', error => {
    if (error) {
        return onError(error)
    }
    room = drone.subscribe(roomName);
    room.on('open', error => {
        if (error) {
            return onError(error)
        }
    })
    room.on('members', members => {
        if (members.length >= 3) {
            return alert('The room is full');
        }
        const isOffer = members.length === 2;
        startWebRTC(isOffer);
        startListeningToSignals();
    })
})

function sendMessage(message) {
    drone.publish({
        room: roomName,
        message
    })
}

let pc;
function startWebRTC(isOffer) {
    pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({'candidate':event.candidate})
        }
    }
    if (isOffer) {
        pc.onnegotiationneeded = () => {
            pc.createOffer().then(localDescCreated).catch(onError)
        }
    }
    pc.onaddstream = event => {
        remoteVideo.srcObject = event.stream;
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localVideo.srcObject = stream;
            pc.addStream(stream)
    },onError)
}

function startListeningToSignals() {
    room.on('data', (message, client) => {
        if (!client || client.id === drone.clientId) return;
        if (message.sdp) {
            pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
                if (pc.remoteDescription.type === 'offer') {
                    pc.createAnswer().then(localDescCreated).catch(onError)
                }
            },onError)
        } else if (message.candidate) {
            pc.addIceCandidate(new RTCIceCandidate(message.candidate),onSuccess,onError)
        }
    })
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc,()=>sendMessage({'sdp':pc.localDescription}),onError)
}