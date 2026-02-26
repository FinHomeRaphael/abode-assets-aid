import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackHeaderProps {
  title?: string;
  fallback?: string;
}

const BackHeader = ({ title, fallback = '/' }: BackHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={handleBack}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Retour"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
    </div>
  );
};

export default BackHeader;
