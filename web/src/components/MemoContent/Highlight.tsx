interface Props {
  content: React.ReactNode;
}

const Highlight: React.FC<Props> = ({ content }: Props) => {
  return <mark>{content}</mark>;
};

export default Highlight;
