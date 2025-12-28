import React from 'react';

function AnimatedBus() {
  return (
    <div className="animated-bus">
      <div className="bus-body">
        <div className="bus-windows">
          <div className="bus-window"></div>
          <div className="bus-window"></div>
        </div>
        <div className="bus-door"></div>
        <div className="bus-wheels">
          <div className="bus-wheel"></div>
          <div className="bus-wheel"></div>
        </div>
        <div className="bus-front">
          <div className="bus-headlight"></div>
        </div>
      </div>
    </div>
  );
}

export default AnimatedBus;

