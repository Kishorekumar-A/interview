import React, { useEffect, useState, useRef } from "react";
import "./ParticipantRoom.css";

function ParticipantRoom({ room, onLeave }) {
  const [mediaStream, setMediaStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [interviewerStream, setInterviewerStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const videoRef = useRef(null);
  const interviewerVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user" 
        },
        audio: true
      });
      setMediaStream(stream);
      if (videoRef.current && !isScreenSharing) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
      setIsMicOn(true);

      // Initialize WebRTC
      await initializeWebRTC();

      // Update participant status in room data
      updateRoomData({
        participantActive: true,
        participantStream: true,
        lastUpdated: new Date().toISOString()
      });

    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
      if (videoRef.current && !isScreenSharing) {
        videoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
      setIsMicOn(false);

      // Close WebRTC connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Update room data
      updateRoomData({
        participantActive: false,
        participantStream: false,
        lastUpdated: new Date().toISOString()
      });
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        setScreenStream(screenStream);
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        
        // Handle when screen sharing is stopped by user
        screenStream.getTracks().forEach(track => {
          track.onended = () => {
            stopScreenShare();
          };
        });
      } catch (err) {
        console.error("Error sharing screen:", err);
        // If user cancels screen share prompt, don't change state
        if (err.name !== 'NotAllowedError') {
          setIsScreenSharing(false);
        }
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScreenSharing(false);
  };

  const initializeWebRTC = async () => {
    try {
      const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Add local stream to connection
      const currentStream = screenStream || mediaStream;
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, currentStream);
        });
      }

      // Handle incoming tracks (interviewer video)
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Received interviewer stream');
        setInterviewerStream(event.streams[0]);
        if (interviewerVideoRef.current) {
          interviewerVideoRef.current.srcObject = event.streams[0];
        }
      };

    } catch (error) {
      console.error('WebRTC initialization error:', error);
    }
  };

  const getRoomData = () => {
    const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
    return rooms.find(r => r.id === room.id);
  };

  const updateRoomData = (updates) => {
    const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
    const updatedRooms = rooms.map(r => {
      if (r.id === room.id) {
        // Update or add participant data
        const existingParticipants = r.participants || [];
        const updatedParticipants = [...existingParticipants];
        
        // Find or create current participant
        let participantIndex = updatedParticipants.findIndex(p => p.id === room.participantId);
        if (participantIndex === -1) {
          updatedParticipants.push({
            id: room.participantId,
            joinedAt: new Date().toISOString(),
            ...updates
          });
        } else {
          updatedParticipants[participantIndex] = {
            ...updatedParticipants[participantIndex],
            ...updates
          };
        }

        return { 
          ...r, 
          participants: updatedParticipants 
        };
      }
      return r;
    });
    localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
  };

  const checkInterviewerStatus = () => {
    const roomData = getRoomData();
    if (roomData) {
      const interviewerActive = roomData.interviewerActive && roomData.interviewerStream;
      
      // Simulate interviewer stream for demo
      if (interviewerActive && !interviewerStream && interviewerVideoRef.current) {
        simulateInterviewerStream();
      } else if (!interviewerActive && interviewerStream) {
        setInterviewerStream(null);
        if (interviewerVideoRef.current) {
          interviewerVideoRef.current.srcObject = null;
        }
      }
    }
  };

  const simulateInterviewerStream = async () => {
    try {
      // Create a simulated interviewer stream for demo
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;
      
      let angle = 0;
      const drawFrame = () => {
        context.fillStyle = '#34495e';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = '#e74c3c';
        context.font = '48px Arial';
        context.textAlign = 'center';
        context.fillText('Interviewer', canvas.width/2, canvas.height/2 - 24);
        context.font = '24px Arial';
        context.fillText('Live Video', canvas.width/2, canvas.height/2 + 24);
        
        // Draw animation
        context.beginPath();
        context.arc(
          canvas.width/2 + Math.cos(angle) * 100,
          canvas.height/2 + Math.sin(angle) * 100,
          20, 0, 2 * Math.PI
        );
        context.fillStyle = '#3498db';
        context.fill();
        
        angle += 0.1;
      };

      const stream = canvas.captureStream(25);
      const drawInterval = setInterval(drawFrame, 40);

      setInterviewerStream(stream);
      if (interviewerVideoRef.current) {
        interviewerVideoRef.current.srcObject = stream;
        interviewerVideoRef.current._drawInterval = drawInterval;
      }

    } catch (error) {
      console.error('Error simulating interviewer stream:', error);
    }
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const toggleMic = () => {
    const currentStream = screenStream || mediaStream;
    if (currentStream) {
      const audioTrack = currentStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: "You",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, message]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  useEffect(() => {
    // Generate unique participant ID if not exists
    if (!room.participantId) {
      room.participantId = `participant-${Date.now()}`;
    }

    startCamera();
    
    const interval = setInterval(checkInterviewerStatus, 2000);
    
    return () => {
      clearInterval(interval);
      stopCamera();
      stopScreenShare();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (interviewerVideoRef.current?._drawInterval) {
        clearInterval(interviewerVideoRef.current._drawInterval);
      }
    };
  }, []);

  // Update WebRTC when stream changes
  useEffect(() => {
    if (peerConnectionRef.current && (mediaStream || screenStream)) {
      // Reinitialize WebRTC with current stream
      initializeWebRTC();
    }
  }, [mediaStream, screenStream]);

  return (
    <div className="participant-room">
      {/* Header */}
      <div className="room-header">
        <div className="header-left">
          <h2>Interview Room - Participant</h2>
          <span className="room-status participant">PARTICIPANT</span>
        </div>
        
        <div className="header-right">
          <div className="room-id">
            <span>Room ID:</span>
            <span className="room-id-value">{room.id}</span>
          </div>
          <button className="leave-button" onClick={onLeave}>Leave Meeting</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="room-content">
        {/* Video Section (80%) */}
        <div className="video-section">
          <div className="video-container">
            <div className="video-grid">
              {/* Interviewer Video */}
              <div className="video-tile interviewer-tile">
                <video 
                  ref={interviewerVideoRef} 
                  autoPlay 
                  playsInline 
                  className="video-element"
                />
                <div className="video-info">
                  <div className="participant-name">
                    Interviewer {interviewerStream ? '(Live)' : '(Offline)'}
                  </div>
                  <div className="video-status">
                    {interviewerStream ? '🔊 📹 Live' : 'Waiting for interviewer...'}
                  </div>
                </div>
                {!interviewerStream && (
                  <div className="video-overlay">
                    <div className="camera-icon">👤</div>
                    <div>Interviewer will join shortly</div>
                  </div>
                )}
              </div>

              {/* Participant Video */}
              <div className="video-tile participant-tile">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`video-element ${isScreenSharing ? '' : 'mirror-effect'} ${(isCameraOn || isScreenSharing) ? 'active' : 'inactive'}`}
                />
                <div className="video-info">
                  <div className="participant-name">
                    You {isScreenSharing ? '(Screen Sharing)' : '(Participant)'}
                  </div>
                  <div className="video-status">
                    {isMicOn ? '🎤' : '🔇'} {isScreenSharing ? '🖥️ Sharing' : (isCameraOn ? '📹' : '📷 Off')}
                    {isScreenSharing && <span style={{marginLeft: '5px', color: '#2ecc71'}}>• LIVE</span>}
                  </div>
                </div>
                {!isCameraOn && !isScreenSharing && (
                  <div className="video-overlay">
                    <div className="camera-icon">📹</div>
                    <div>Your camera is off</div>
                  </div>
                )}
                {isScreenSharing && (
                  <div className="screen-share-indicator">
                    <span>🖥️ Screen Sharing Active</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="bottom-controls">
              <button 
                onClick={toggleMic} 
                className={`control-button mic-button ${isMicOn ? 'active' : 'inactive'}`}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                <span className="control-icon">{isMicOn ? "🎤" : "🔇"}</span>
              </button>
              
              <button 
                onClick={toggleCamera} 
                className={`control-button camera-button ${isCameraOn ? 'active' : 'inactive'}`}
                title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
                disabled={isScreenSharing}
              >
                <span className="control-icon">{isCameraOn ? "📹" : "📷"}</span>
              </button>
              
              <button 
                onClick={toggleScreenShare} 
                className={`control-button share-button ${isScreenSharing ? 'active' : 'inactive'}`}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                <span className="control-icon">{isScreenSharing ? "🖥️" : "📤"}</span>
              </button>

              <button className="leave-meeting-button" onClick={onLeave}>
                Leave Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Chat Section (20%) */}
        <div className="chat-section">
          <div className="chat-container">
            <div className="chat-header"><h3>Chat</h3></div>
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet</p>
                  <span>Start a conversation with the interviewer</span>
                </div>
              ) : (
                messages.map(message => (
                  <div key={message.id} className={`message ${message.sender === 'You' ? 'own-message' : 'other-message'}`}>
                    <div className="message-sender">{message.sender}</div>
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">{message.timestamp}</div>
                  </div>
                ))
              )}
            </div>
            <div className="message-input-container">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="message-input"
              />
              <button onClick={sendMessage} className="send-button">Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParticipantRoom;