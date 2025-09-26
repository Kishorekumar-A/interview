import React, { useState, useEffect } from 'react';
import { FaKeyboard, FaUser, FaGoogle, FaTimes, FaSignInAlt, FaUserPlus, FaSignOutAlt, FaLock } from 'react-icons/fa';
import InterviewRoom from './InterviewRoom';
import ParticipantRoom from './ParticipantRoom';
import './InterviewLandingPage.css';

const InterviewLandingPage = () => {
  const [interviewCode, setInterviewCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [existingRooms, setExistingRooms] = useState([]);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  // Load existing rooms, user data, and current room from localStorage on component mount
  useEffect(() => {
    const storedRooms = localStorage.getItem('interviewRooms');
    if (storedRooms) {
      setExistingRooms(JSON.parse(storedRooms));
    }

    const storedUser = localStorage.getItem('interviewUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load current room from localStorage to persist on refresh
    const storedCurrentRoom = localStorage.getItem('currentRoom');
    if (storedCurrentRoom) {
      const roomData = JSON.parse(storedCurrentRoom);
      
      // Verify the room still exists in the rooms list
      const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
      const roomExists = rooms.find(room => room.id === roomData.id);
      
      if (roomExists) {
        setCurrentRoom(roomData);
        
        // If user was in a room, update their active status
        if (roomData.isJoining) {
          // Update participant status
          const updatedRooms = rooms.map(room => {
            if (room.id === roomData.id) {
              const updatedParticipants = room.participants?.map(participant => {
                if (participant.user?.id === user?.id) {
                  return { ...participant, isActive: true };
                }
                return participant;
              }) || [];
              return { ...room, participants: updatedParticipants };
            }
            return room;
          });
          localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
        } else {
          // Update interviewer status
          const updatedRooms = rooms.map(room => {
            if (room.id === roomData.id) {
              return { 
                ...room, 
                interviewer: { 
                  ...room.interviewer, 
                  isActive: true 
                } 
              };
            }
            return room;
          });
          localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
        }
      } else {
        // Room no longer exists, clear current room
        localStorage.removeItem('currentRoom');
      }
    }
  }, []);

  // Save current room to localStorage whenever it changes
  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem('currentRoom', JSON.stringify(currentRoom));
    } else {
      localStorage.removeItem('currentRoom');
    }
  }, [currentRoom]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const generateRoomId = () => {
    const min = 100000;
    const max = 999999;
    const roomId = Math.floor(Math.random() * (max - min + 1)) + min;
    setGeneratedRoomId(roomId.toString());
    return roomId.toString();
  };

  const saveRoomToStorage = (roomData) => {
    const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
    const updatedRooms = [...rooms, roomData];
    localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
    setExistingRooms(updatedRooms);
  };

  const getRoomFromStorage = (roomId) => {
    const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
    return rooms.find(room => room.id === roomId);
  };

  const handleCreateInterview = () => {
    if (!user) {
      alert('Please login to create an interview room.');
      return;
    }
    const newRoomId = generateRoomId();
    setShowOverlay(true);
  };

  const handleJoinInterview = () => {
    if (!user) {
      alert('Please login to join an interview room.');
      return;
    }

    if (interviewCode.trim()) {
      if (!/^\d{6}$/.test(interviewCode.trim())) {
        setJoinError('Please enter a valid 6-digit room code');
        return;
      }

      const room = getRoomFromStorage(interviewCode.trim());
      if (!room) {
        setJoinError('Room not found. Please check the room ID.');
        return;
      }

      // Check password
      if (room.password !== joinRoomPassword) {
        setJoinError('Invalid room password. Please check the password.');
        return;
      }

      console.log(`Joining interview as participant with code: ${interviewCode}`);
      
      const roomData = {
        id: interviewCode.trim(),
        password: room.password,
        createdAt: room.createdAt,
        isJoining: true,
        participants: room.participants || []
      };

      // Update room with new participant
      const updatedRoom = {
        ...room,
        participants: [...(room.participants || []), {
          id: `participant-${Date.now()}`,
          joinedAt: new Date().toISOString(),
          isActive: true,
          user: user
        }]
      };

      const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
      const updatedRooms = rooms.map(r => r.id === room.id ? updatedRoom : r);
      localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
      setExistingRooms(updatedRooms);

      setCurrentRoom(roomData);
      setJoinError('');
      setJoinRoomPassword(''); // Clear password after successful join
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
        isJoining: false,
        participants: [],
        interviewer: {
          id: `interviewer-${Date.now()}`,
          joinedAt: new Date().toISOString(),
          isActive: true,
          user: user
        }
      };
      
      saveRoomToStorage(roomData);
      console.log(`Creating room ${generatedRoomId} with password: ${roomPassword}`);
      setCurrentRoom(roomData);
      setShowOverlay(false);
      setRoomPassword('');
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    
    if (authMode === 'signup') {
      if (authForm.password !== authForm.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      // Simulate sign up
      const newUser = {
        id: Date.now(),
        email: authForm.email,
        firstName: authForm.firstName,
        lastName: authForm.lastName,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem('interviewUser', JSON.stringify(newUser));
      setUser(newUser);
      setShowAuthOverlay(false);
      setShowProfileMenu(false);
      setAuthForm({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
      alert('Account created successfully!');
    } else {
      // Simulate sign in (in real app, this would verify credentials)
      const storedUser = localStorage.getItem('interviewUser');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.email === authForm.email) {
          setUser(userData);
          setShowAuthOverlay(false);
          setShowProfileMenu(false);
          setAuthForm({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
          alert('Login successful!');
        } else {
          alert('Invalid credentials');
        }
      } else {
        alert('No account found. Please sign up first.');
      }
    }
  };

  const handleGoogleAuth = () => {
    // Simulate Google authentication
    const googleUser = {
      id: Date.now(),
      email: 'user@gmail.com',
      firstName: 'Google',
      lastName: 'User',
      createdAt: new Date().toISOString(),
      isGoogleAuth: true
    };
    
    localStorage.setItem('interviewUser', JSON.stringify(googleUser));
    setUser(googleUser);
    setShowAuthOverlay(false);
    setShowProfileMenu(false);
    alert('Successfully authenticated with Google!');
  };

  const handleLogout = () => {
    localStorage.removeItem('interviewUser');
    setUser(null);
    setShowProfileMenu(false);
    alert('Logged out successfully!');
  };

  const closeOverlay = () => {
    setShowOverlay(false);
    setRoomPassword('');
  };

  const closeAuthOverlay = () => {
    setShowAuthOverlay(false);
    setAuthForm({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  };

  const switchAuthMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    setAuthForm({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const leaveMeeting = () => {
    if (currentRoom) {
      // Update room status when leaving
      const rooms = JSON.parse(localStorage.getItem('interviewRooms') || '[]');
      const updatedRooms = rooms.map(room => {
        if (room.id === currentRoom.id) {
          if (currentRoom.isJoining) {
            // Participant leaving - mark as inactive
            return {
              ...room,
              participants: room.participants?.map(p => ({
                ...p,
                isActive: false
              }))
            };
          } else {
            // Interviewer leaving - mark as inactive
            return {
              ...room,
              interviewer: {
                ...room.interviewer,
                isActive: false
              }
            };
          }
        }
        return room;
      });
      localStorage.setItem('interviewRooms', JSON.stringify(updatedRooms));
    }

    setCurrentRoom(null);
    setInterviewCode('');
    setJoinRoomPassword('');
    setJoinError('');
  };if (currentRoom) {
    if (currentRoom.isJoining) {
      return <ParticipantRoom room={currentRoom} onLeave={leaveMeeting} />;
    } else {
      return <InterviewRoom room={currentRoom} onLeave={leaveMeeting} />;
    }
  }


  return (
    <div className="landing-container">
      {/* Room Creation Overlay */}
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
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Authentication Overlay */}
      {showAuthOverlay && (
        <div className="overlay">
          <div className="overlay-content auth-overlay">
            <div className="auth-content">
              <h3>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</h3>
              
              <form onSubmit={handleAuthSubmit} className="auth-form">
                {authMode === 'signup' && (
                  <div className="name-fields">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={authForm.firstName}
                      onChange={(e) => setAuthForm({...authForm, firstName: e.target.value})}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={authForm.lastName}
                      onChange={(e) => setAuthForm({...authForm, lastName: e.target.value})}
                      required
                    />
                  </div>
                )}
                
                <input
                  type="email"
                  placeholder="Email address"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  required
                />
                
                <input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                  required
                />
                
                {authMode === 'signup' && (
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({...authForm, confirmPassword: e.target.value})}
                    required
                  />
                )}
                
                <button type="submit" className="auth-submit-button">
                  {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              </form>

              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <button className="google-auth-button" onClick={handleGoogleAuth}>
                <FaGoogle className="google-icon" />
                Google
              </button>

              <div className="auth-switch">
                <p>
                  {authMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                  <button type="button" className="auth-switch-button" onClick={switchAuthMode}>
                    {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </div>
            <button className="overlay-close" onClick={closeAuthOverlay}>
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      <div className="header">True Hire</div>
      
      {/* Profile Icon with Dropdown Menu */}
      <div className="profile-menu-container">
        <div 
          className="profile-icon"
          onClick={toggleProfileMenu}
        >
          <FaUser />
        </div>

        {/* Profile Dropdown Menu */}
        {showProfileMenu && (
          <div className="profile-dropdown">
            {user ? (
              <>
                <div className="profile-header">
                  <div className="user-avatar">
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.firstName} {user.lastName}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout}>
                  <FaSignOutAlt className="dropdown-icon" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <button 
                  className="dropdown-item" 
                  onClick={() => {
                    setShowAuthOverlay(true);
                    setAuthMode('signin');
                    setShowProfileMenu(false);
                  }}
                >
                  <FaSignInAlt className="dropdown-icon" />
                  Sign In
                </button>
                <button 
                  className="dropdown-item" 
                  onClick={() => {
                    setShowAuthOverlay(true);
                    setAuthMode('signup');
                    setShowProfileMenu(false);
                  }}
                >
                  <FaUserPlus className="dropdown-icon" />
                  Sign Up
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item google-auth-dropdown" onClick={handleGoogleAuth}>
                  <FaGoogle className="dropdown-icon" />
                  Continue with Google
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
              <div className="join-inputs-container">
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
                
                <div className="input-container">
                  <FaLock className="input-icon" />
                  <input
                    type="password"
                    placeholder="Room password"
                    value={joinRoomPassword}
                    onChange={(e) => {
                      setJoinRoomPassword(e.target.value);
                      setJoinError('');
                    }}
                    className="code-input"
                  />
                </div>
              </div>
              
              <button 
                className="secondary-button"
                onClick={handleJoinInterview}
                disabled={!interviewCode.trim() || !joinRoomPassword.trim()}
              >
                Join Interview
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