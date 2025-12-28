import { useDispatch, useSelector } from 'react-redux';

// Typed hooks for TypeScript-like usage in JavaScript
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

