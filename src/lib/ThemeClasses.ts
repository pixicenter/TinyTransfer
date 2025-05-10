// Function to generate CSS classes based on theme
export const getThemeClasses = (theme: 'light' | 'dark') => {
  return {
    header: {
      bg: theme === 'dark' ? 'bg-gray-900' : 'bg-white',
      text: theme === 'dark' ? 'text-white' : 'text-indigo-600',
      navText: theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-indigo-600',
    },
    footer: {
      bg: theme === 'dark' ? 'bg-gray-900' : 'bg-white',
      text: theme === 'dark' ? 'text-gray-300' : 'text-gray-600',
    },
    body: {
      bg: theme === 'dark' ? 'bg-gray-900' : 'bg-white',
      text: theme === 'dark' ? 'text-white' : 'text-gray-800',
    }
  };
}; 