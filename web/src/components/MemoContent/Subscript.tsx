interface Props {
  content: React.ReactNode;
}

const Subscript: React.FC<Props> = ({ content }: Props) => {
  return <sub>{content}</sub>;
};

export default Subscript;
