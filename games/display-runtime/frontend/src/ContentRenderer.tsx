import React from 'react';

interface ContentItem {
  id: number;
  title: string;
  content_type: string;
  duration_seconds: number;
  file_path?: string;
  url?: string;
  text_content?: string;
  bg_color?: string;
  text_color?: string;
}

interface ContentRendererProps {
  item: ContentItem;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ item }) => {
  const renderContent = () => {
    switch (item.content_type) {
      case 'image':
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000'
          }}>
            <img
              src={`http://192.168.1.45:5050${item.file_path}`}
              alt={item.title}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        );

      case 'url':
        return (
          <iframe
            src={item.url}
            title={item.title}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            sandbox="allow-scripts allow-same-origin allow-forms"
            onError={(e) => console.error('URL iframe failed to load', e)}
          />
        );

      case 'social_feed':
        return (
          <iframe
            src={item.url}
            title={item.title}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            sandbox="allow-scripts allow-same-origin"
            onError={(e) => console.error('Social feed iframe failed to load', e)}
          />
        );

      case 'leaderboard':
        return (
          <iframe
            src="http://192.168.1.45:5030"
            title="Leaderboard"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            sandbox="allow-scripts allow-same-origin"
            onError={(e) => console.error('Leaderboard iframe failed to load', e)}
          />
        );

      case 'schedule':
        return (
          <iframe
            src="http://192.168.1.45:5040"
            title="Season Schedule"
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            sandbox="allow-scripts allow-same-origin"
            onError={(e) => console.error('Schedule iframe failed to load', e)}
          />
        );

      case 'announcement':
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: item.bg_color || '#1a1a1a',
            color: item.text_color || '#ffffff',
            padding: '60px',
            textAlign: 'center'
          }}>
            <h1 style={{
              fontSize: '72px',
              fontWeight: 'bold',
              margin: 0,
              lineHeight: 1.2,
              maxWidth: '90%',
              wordWrap: 'break-word'
            }}>
              {item.title}
            </h1>
            {item.text_content && (
              <p style={{
                fontSize: '36px',
                marginTop: '40px',
                maxWidth: '80%',
                lineHeight: 1.4
              }}>
                {item.text_content}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            fontSize: '24px'
          }}>
            Unknown content type: {item.content_type}
          </div>
        );
    }
  };

  return <div style={{ width: '100%', height: '100%' }}>{renderContent()}</div>;
};

export default ContentRenderer;
