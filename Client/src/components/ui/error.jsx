export const ErrorText = ({ message }) => {
  if (!message) return null;
  return <p className="text-red-500 text-sm">{message}</p>;
};
