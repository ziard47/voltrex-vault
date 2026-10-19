/**
 * Voltrex Vault - Material UI Custom Theme
 * Restrained, accessible, high-contrast dark palette tailored for desktop.
 * Colors: #000000 (Black), #3E432E (Muted Olive), #616F39 (Medium Olive), #A7D129 (Volt Lime)
 */

import { createTheme } from '@mui/material/styles';

export const vaultTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#A7D129', // Accent
      light: '#bce045',
      dark: '#8eb31c',
      contrastText: '#000000',
    },
    secondary: {
      main: '#616F39',
      light: '#728343',
      dark: '#4c572b',
      contrastText: '#ffffff',
    },
    background: {
      default: '#000000',
      paper: '#0c0d0a',
    },
    text: {
      primary: '#f4f6f0',
      secondary: '#a2a894',
      disabled: '#5a604a',
    },
    divider: '#3E432E',
    error: {
      main: '#e05252',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d99b26',
      contrastText: '#000000',
    },
    success: {
      main: '#A7D129',
      contrastText: '#000000',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 4, // Restrained flat desktop aesthetic
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0c0d0a',
          border: '1px solid #3E432E',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '6px 14px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          backgroundColor: '#A7D129',
          color: '#000000',
          '&:hover': {
            backgroundColor: '#93b824',
          },
        },
        outlinedSecondary: {
          borderColor: '#3E432E',
          color: '#f4f6f0',
          '&:hover': {
            borderColor: '#616F39',
            backgroundColor: 'rgba(97, 111, 57, 0.1)',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          border: '1px solid #3E432E',
          borderRadius: 4,
          color: '#f4f6f0',
          fontSize: '0.875rem',
          '&.Mui-focused': {
            borderColor: '#A7D129',
          },
        },
        input: {
          padding: '8px 12px',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3E432E',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#616F39',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#A7D129',
            borderWidth: 1,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0c0d0a',
          border: '1px solid #3E432E',
          boxShadow: 'none',
        },
      },
    },
  },
});
