import React from 'react';

function LogoSection({ trustQuote, quoteAuthor }) {
  return (
    <div className="logo-section">
      <img src="/images/logo.jpg" alt="JourneyJunction Logo" className="page-logo" />
      <h2>JourneyJunction</h2>
      <div className="trust-quote">
        {trustQuote}
        <div className="quote-author">{quoteAuthor}</div>
      </div>
    </div>
  );
}

export default LogoSection;

