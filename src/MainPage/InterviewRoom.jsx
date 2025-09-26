import React, { useEffect, useState, useRef } from "react";
import "./InterviewRoom.css";

function InterviewRoom({ room, onLeave }) {
  const [aiResults, setAiResults] = useState({
    faces: 0,
    eye_moves: 0,
    face_alert: "",
    gender: "Unknown",
    mood: "neutral",
    bg_voice: false,
    lipsync: false,
    verification: "Not set",
    speech: false,
    mouth_ratio: 0,
    interview_active: false
  });
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [interviewStatus, setInterviewStatus] = useState("not_started");
  const [mediaStream, setMediaStream] = useState(null);
  const [participantStream, setParticipantStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeParticipants, setActiveParticipants] = useState(0);
  const videoRef = useRef(null);
  const participantVideoRef = useRef(null);
  const wsRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);

  // Simple WebRTC implementation for demo
  const initializeWebRTC = async () => {
    try {
      // Create RTCPeerConnection
      const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      peerConnectionRef.current = new RTCPeerConnection(configuration);

      // Add local stream to connection
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, mediaStream);
        });
      }

      // Handle incoming tracks (participant video)
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Received remote stream');
        setParticipantStream(event.streams[0]);
        if (participantVideoRef.current) {
          participantVideoRef.current.srcObject = event.streams[0];
        }
        setActiveParticipants(1);
      };

      // Handle ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to participant (simulated)
          console.log('ICE candidate generated');
        }
      };

      // Create data channel for messaging
      dataChannelRef.current = peerConnectionRef.current.createDataChannel('chat');
      dataChannelRef.current.onmessage = (event) => {
        console.log('Message from participant:', event.data);
      };

    } catch (error) {
      console.error('WebRTC initialization error:', error);
    }
  };

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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOn(true);
      setIsMicOn(true);

      // Initialize WebRTC after getting local stream
      await initializeWebRTC();

      // Save interviewer stream status to localStorage
      updateRoomData({
        interviewerActive: true,
        interviewerStream: true,
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
      if (videoRef.current) {
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
        interviewerActive: false,
        interviewerStream: false,
        lastUpdated: new Date().toISOString()
      });
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
        return { ...r, ...updates };
      }
      return r;
    });
    localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
  };

  const checkParticipantStatus = () => {
    const roomData = getRoomData();
    if (roomData) {
      const participantCount = roomData.participants?.filter(p => p.isActive && p.streamActive).length || 0;
      setActiveParticipants(participantCount);

      // Simulate participant stream for demo (in real app, this would be actual WebRTC)
      if (participantCount > 0 && !participantStream && participantVideoRef.current) {
        // Create a simulated participant stream for demo purposes
        simulateParticipantStream();
      } else if (participantCount === 0 && participantStream) {
        // Clear participant stream if no participants
        setParticipantStream(null);
        if (participantVideoRef.current) {
          participantVideoRef.current.srcObject = null;
        }
      }
    }
  };

  const simulateParticipantStream = async () => {
    try {
      // For demo purposes, create a test video stream
      // In a real application, this would be the actual participant's stream via WebRTC
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;
      
      // Create a simple animation for the demo stream
      let angle = 0;
      const drawFrame = () => {
        context.fillStyle = '#2c3e50';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = '#3498db';
        context.font = '48px Arial';
        context.textAlign = 'center';
        context.fillText('Participant', canvas.width/2, canvas.height/2 - 24);
        context.font = '24px Arial';
        context.fillText('Live Video', canvas.width/2, canvas.height/2 + 24);
        
        // Draw a rotating circle for animation
        context.beginPath();
        context.arc(
          canvas.width/2 + Math.cos(angle) * 100,
          canvas.height/2 + Math.sin(angle) * 100,
          20, 0, 2 * Math.PI
        );
        context.fillStyle = '#e74c3c';
        context.fill();
        
        angle += 0.1;
      };

      // Create stream from canvas
      const stream = canvas.captureStream(25);
      const drawInterval = setInterval(drawFrame, 40);

      setParticipantStream(stream);
      if (participantVideoRef.current) {
        participantVideoRef.current.srcObject = stream;
      }

      // Store interval ID for cleanup
      participantVideoRef.current._drawInterval = drawInterval;

    } catch (error) {
      console.error('Error simulating participant stream:', error);
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
    if (mediaStream) {
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        
        screenStream.getTracks().forEach(track => {
          track.onended = () => {
            if (videoRef.current && mediaStream) {
              videoRef.current.srcObject = mediaStream;
            }
            setIsScreenSharing(false);
          };
        });
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    } else {
      if (videoRef.current && mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsScreenSharing(false);
    }
  };

  const startInterview = async () => {
    try {
      await startCamera();
      
      const response = await fetch("http://localhost:8000/start_interview", {
        method: "POST",
      });
      const result = await response.json();
      if (result.status === "success") {
        setInterviewStatus("active");
        connectWebSocket();
      }
      alert(result.message);
    } catch (err) {
      console.error("Error starting interview:", err);
      alert("Error starting interview");
    }
  };

  const stopInterview = async () => {
    try {
      stopCamera();
      
      const response = await fetch("http://localhost:8000/stop_interview", {
        method: "POST",
      });
      const result = await response.json();
      if (result.status === "success") {
        setInterviewStatus("inactive");
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
      alert(result.message);
    } catch (err) {
      console.error("Error stopping interview:", err);
      alert("Error stopping interview");
    }
  };

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket("ws://localhost:8000/ws");
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setAiResults(prev => ({ ...prev, ...data }));
          setInterviewStatus(data.interview_active ? "active" : "inactive");
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionStatus("disconnected");
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error("WebSocket connection failed:", err);
      setConnectionStatus("error");
    }
  };

  const setReferenceFace = async () => {
    try {
      const response = await fetch("http://localhost:8000/set_reference_face", {
        method: "POST",
      });
      const result = await response.json();
      alert(result.message);
    } catch (err) {
      console.error("Error setting reference face:", err);
      alert("Error setting reference face");
    }
  };

  useEffect(() => {
    // Set up interval to check for participant status
    const interval = setInterval(checkParticipantStatus, 2000);
    
    return () => {
      clearInterval(interval);
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      // Clean up canvas animation if exists
      if (participantVideoRef.current?._drawInterval) {
        clearInterval(participantVideoRef.current._drawInterval);
      }

      // Update room status when leaving
      updateRoomData({
        interviewerActive: false,
        interviewerStream: false,
        lastUpdated: new Date().toISOString()
      });
    };
  }, []);

  return (
    <div className="interview-room">
      {/* Top Header */}
      <div className="room-header">
        <div className="header-left">
          <h2>AI Interview Room - Interviewer</h2>
          <span className={`room-status ${room.isJoining ? 'joined' : 'hosting'}`}>
            {room.isJoining ? 'JOINED' : 'HOSTING'}
          </span>
        </div>
        
        <div className="header-right">
          <div className="room-id">
            <span>Room ID:</span>
            <span className="room-id-value">{room.id}</span>
          </div>
          
          <button className="leave-button" onClick={onLeave}>
            Leave Meeting
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="room-content">
        {/* Video Section (75%) */}
        <div className="video-section">
          {/* Video Container */}
          <div className="video-container">
            {/* Video Grid - Two videos side by side */}
            <div className="video-grid">
              {/* Interviewer Video */}
              <div className="video-tile interviewer-tile">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className={`video-element mirror-effect ${isCameraOn ? 'active' : 'inactive'}`}
                />
                <div className="video-info">
                  <div className="participant-name">You (Interviewer)</div>
                  <div className="video-status">
                    {isMicOn ? '🎤' : '🔇'} {isCameraOn ? '📹' : '📷 Off'}
                  </div>
                </div>
                {!isCameraOn && (
                  <div className="video-overlay">
                    <div className="camera-icon">📹</div>
                    <div>Your camera is off</div>
                  </div>
                )}
              </div>

              {/* Participant Video */}
              <div className={`video-tile participant-tile ${activeParticipants > 0 ? 'active' : 'inactive'}`}>
                <video 
                  ref={participantVideoRef} 
                  autoPlay 
                  playsInline 
                  className="video-element"
                />
                <div className="video-info">
                  <div className="participant-name">
                    Participant {activeParticipants > 0 ? '(Live)' : '(Offline)'}
                  </div>
                  <div className="video-status">
                    {activeParticipants > 0 ? '🔊 📹 Live' : 'Waiting for participant...'}
                  </div>
                </div>
                {activeParticipants === 0 && (
                  <div className="video-overlay">
                    <div className="camera-icon">👤</div>
                    <div>Waiting for participant</div>
                  </div>
                )}
              </div>
            </div>

            {/* Start Interview Button */}
            <div className="start-interview-container">
              <button 
                onClick={interviewStatus === "active" ? stopInterview : startInterview}
                disabled={interviewStatus === "active" && !mediaStream}
                className={`start-interview-button ${interviewStatus === "active" ? 'stop' : 'start'}`}
              >
                <span className="start-button-icon">{interviewStatus === "active" ? '⏹️' : '▶️'}</span>
                <span className="start-button-text">{interviewStatus === "active" ? "End Interview" : "Start Interview"}</span>
              </button>
            </div>

            {/* Controls - Bottom Center */}
            <div className="bottom-controls">
              <button 
                onClick={toggleMic}
                className={`control-button mic-button ${isMicOn ? 'active' : 'inactive'}`}
                title={isMicOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                <span className="control-icon">
                  {isMicOn ? "🎤" : "🔇"}
                </span>
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`control-button camera-button ${isCameraOn ? 'active' : 'inactive'}`}
                title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
              >
                <span className="control-icon">
                  {isCameraOn ? "📹" : "📷"}
                </span>
              </button>
              
              <button 
                onClick={toggleScreenShare}
                className={`control-button share-button ${isScreenSharing ? 'active' : 'inactive'}`}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                <span className="control-icon">🖥️</span>
              </button>

              <button 
                onClick={setReferenceFace}
                className="control-button reference-button"
                title="Set Reference Face"
              >
                <span className="control-icon">👤</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - AI Results (25%) */}
        <div className="results-section">
       
          {/* AI Detection Results Box */}
          <div className="results-container">
            <h3 className="results-title">AI Detection Results</h3>
            
            <div className="results-grid">
              <div className="result-item">
                <span className="result-label">Faces Detected</span>
                <span className="result-value">
                  {aiResults.faces}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Eye Movements</span>
                <span className="result-value">
                  {aiResults.eye_moves}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Gender</span>
                <span className="result-value">
                  {aiResults.gender}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Emotion</span>
                <span className="result-value">
                  {aiResults.mood}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Speech Detection</span>
                <span className="result-value">
                  {aiResults.speech ? "Detected" : "None"}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Lip Sync</span>
                <span className="result-value">
                  {aiResults.lipsync ? "Good" : "Poor"}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Background Voice</span>
                <span className="result-value">
                  {aiResults.bg_voice ? "Detected" : "None"}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Mouth Activity</span>
                <span className="result-value">
                  {aiResults.mouth_ratio.toFixed(3)}
                </span>
              </div>

              <div className="result-item">
                <span className="result-label">Face Verification</span>
                <span className="result-value">
                  {aiResults.verification}
                </span>
              </div>
            </div>

            {/* Face Alerts */}
            {aiResults.face_alert && (
              <div className="alert-message">
                <strong>ALERT:</strong> {aiResults.face_alert}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InterviewRoom;