import React, { useState } from 'react';
import { FaKeyboard, FaUser } from 'react-icons/fa';
import InterviewRoom from './InterviewRoom';
import './InterviewLandingPage.css';

const InterviewLandingPage = () => {
  const [interviewCode, setInterviewCode] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [joinError, setJoinError] = useState('');

  const generateRoomId = () => {
    const min = 100000;
    const max = 999999;
    const roomId = Math.floor(Math.random() * (max - min + 1)) + min;
    setGeneratedRoomId(roomId.toString());
    return roomId.toString();
  };

  const handleCreateInterview = () => {
    const newRoomId = generateRoomId();
    setShowOverlay(true);
  };

  const handleJoinInterview = () => {
    if (interviewCode.trim()) {
      if (!/^\d{6}$/.test(interviewCode.trim())) {
        setJoinError('Please enter a valid 6-digit room code');
        return;
      }
      
      console.log(`Joining interview with code: ${interviewCode}`);
      
      const roomData = {
        id: interviewCode.trim(),
        password: '',
        createdAt: new Date().toISOString(),
        isJoining: true
      };
      
      setCurrentRoom(roomData);
      setJoinError('');
    } else {
      setJoinError('Please enter a room code');
    }
  };

  const handleCreateRoom = () => {
    if (roomPassword.trim()) {
      const roomData = {
        id: generatedRoomId,
        password: roomPassword,
        createdAt: new Date().toISOString(),
        isJoining: false
      };
      
      console.log(`Creating room ${generatedRoomId} with password: ${roomPassword}`);
      setCurrentRoom(roomData);
      setShowOverlay(false);
      setRoomPassword('');
    }
  };

  const closeOverlay = () => {
    setShowOverlay(false);
    setRoomPassword('');
  };

  const leaveMeeting = () => {
    setCurrentRoom(null);
    setInterviewCode('');
    setJoinError('');
  };

  if (currentRoom) {
    return <InterviewRoom room={currentRoom} onLeave={leaveMeeting} />;
  }

  return (
    <div className="landing-container">
      {showOverlay && (
        <div className="overlay">
          <div className="overlay-content">
            <div className="room-creation">
              <h3>Create New Interview Room</h3>
              <div className="room-id-display">
                <span className="room-id-label">Room ID:</span>
                <span className="room-id-value">{generatedRoomId}</span>
              </div>
              <div className="password-input-container">
                <input
                  type="password"
                  placeholder="Set room password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="password-input"
                />
              </div>
              <button 
                className="create-room-button"
                onClick={handleCreateRoom}
                disabled={!roomPassword.trim()}
              >
                Create Room
              </button>
            </div>
            <button className="overlay-close" onClick={closeOverlay}>
              ×
            </button>
          </div>
        </div>
      )}

      <div className="header">True Hire</div>
      <div className='header-divider'><FaUser /></div>

      <div className="landing-content">
        <div className="text-section">
          <h1 className="landing-title">As interviews meet innovation</h1>
          <p className="landing-subtitle">
            Meet the best, work together seamlessly, hire without stress
          </p>
        </div>
        
        <div className="action-section">
          <div className="action-buttons">
            <button className="primary-button" onClick={handleCreateInterview}>
              Create an Interview
            </button>
            
            <div className="divider">
              <span>or</span>
            </div>
            
            <div className="join-section">
              <div className="input-container">
                <FaKeyboard className="input-icon" />
                <input
                  type="text"
                  placeholder="Enter interview room ID"
                  value={interviewCode}
                  onChange={(e) => {
                    setInterviewCode(e.target.value);
                    setJoinError('');
                  }}
                  className="code-input"
                  maxLength="6"
                />
              </div>
              <button 
                className="secondary-button"
                onClick={handleJoinInterview}
                disabled={!interviewCode.trim()}
              >
                Join
              </button>
            </div>
            
            {joinError && (
              <div className="error-message">
                {joinError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewLandingPage;