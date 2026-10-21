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
    MuiCheckbox: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          color: '#616F39',
          padding: 4,
          '&.Mui-checked': {
            color: '#A7D129',
          },
          '&.Mui-disabled': {
            color: '#3E432E',
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#A7D129',
          height: 4,
        },
        thumb: {
          width: 14,
          height: 14,
          backgroundColor: '#A7D129',
          '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
            boxShadow: '0 0 0 8px rgba(167, 209, 41, 0.16)',
          },
        },
        rail: {
          backgroundColor: '#3E432E',
          opacity: 1,
        },
        track: {
          backgroundColor: '#A7D129',
          border: 'none',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          backgroundColor: '#0a0b08',
          color: '#f4f6f0',
          fontSize: '0.75rem',
        },
        icon: {
          color: '#A7D129',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0c0d0a !important',
          border: '1px solid #3E432E !important',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8) !important',
        },
        list: {
          padding: 4,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          color: '#f4f6f0',
          borderRadius: 3,
          margin: '2px 0',
          padding: '6px 10px',
          '&:hover': {
            backgroundColor: '#1b2013',
            color: '#ffffff',
          },
          '&.Mui-selected': {
            backgroundColor: '#273114 !important',
            color: '#A7D129',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#303c19 !important',
            },
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#a2a894',
          fontSize: '0.75rem',
          '&.Mui-focused': {
            color: '#A7D129',
          },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          marginLeft: -4,
          marginRight: 8,
        },
        label: {
          fontSize: '0.75rem',
          color: '#f4f6f0',
          userSelect: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          fontSize: '0.75rem',
          color: '#f4f6f0',
          borderRadius: 4,
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
          '& input': {
            padding: '7px 10px',
          },
          '& textarea': {
            padding: '4px 2px',
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
