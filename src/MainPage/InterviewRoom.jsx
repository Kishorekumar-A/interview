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
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const videoRef = useRef(null);
  const wsRef = useRef(null);

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
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="interview-room">
      {/* Top Header */}
      <div className="room-header">
        <div className="header-left">
          <h2>AI Interview Room</h2>
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
        {/* Left Side - Video (75%) */}
        <div className="video-section">
          {/* Video Container */}
          <div className="video-container">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className={`video-element ${isCameraOn ? 'active' : 'inactive'}`}
            />
            
            {!isCameraOn && (
              <div className="camera-off-placeholder">
                <div className="camera-icon">📹</div>
                Camera is off. Start interview to begin.
              </div>
            )}

            {/* Start Interview Button - Left Side */}
            <div className="start-interview-container">
              <button 
                onClick={interviewStatus === "active" ? stopInterview : startInterview}
                disabled={interviewStatus === "active" && !mediaStream}
                className={`start-interview-button ${interviewStatus === "active" ? 'stop' : 'start'}`}
                title={interviewStatus === "active" ? "Stop Interview" : "Start Interview"}
              >
                <span className="start-button-icon">{interviewStatus === "active" ? '⏹️' : '▶️'}</span>
                <span className="start-button-text">{interviewStatus === "active" ? "Stop Interview" : "Start Interview"}</span>
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
                  {isMicOn ? "🎤" : "🎤"}
                </span>
                <span className="control-text">{isMicOn ? "Mute" : "Unmute"}</span>
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`control-button camera-button ${isCameraOn ? 'active' : 'inactive'}`}
                title={isCameraOn ? "Turn Off Camera" : "Turn On Camera"}
              >
                <span className="control-icon">
                  {isCameraOn ? "📹" : "📷"}
                </span>
                <span className="control-text">{isCameraOn ? "Stop Video" : "Start Video"}</span>
              </button>
              
              <button 
                onClick={toggleScreenShare}
                className={`control-button share-button ${isScreenSharing ? 'active' : 'inactive'}`}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                <span className="control-icon">🖥️</span>
                <span className="control-text">{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
              </button>

              <button 
                onClick={setReferenceFace}
                className="control-button reference-button"
                title="Set Reference Face"
              >
                <span className="control-icon">👤</span>
                <span className="control-text">Reference Face</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - AI Results (25%) */}
        <div className="results-section">
          {/* Status Cards */}
          <div className="status-cards">
            <div className={`status-card connection-${connectionStatus}`}>
              <span className="status-label">Connection</span>
              <span className="status-value">{connectionStatus.toUpperCase()}</span>
            </div>
            
            <div className={`status-card interview-${interviewStatus}`}>
              <span className="status-label">Interview</span>
              <span className="status-value">{interviewStatus.toUpperCase()}</span>
            </div>
          </div>

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