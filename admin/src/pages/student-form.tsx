import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createStudent, getStudent, updateStudent } from '@/services';

export function StudentFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') return;
    let cancelled = false;
    (async () => {
      try {
        const student = await getStudent(studentId);
        if (cancelled) return;
        setName(student.name);
        setEmail(student.email);
        setPhone(student.phone === '—' ? '' : student.phone);
        setCourse(student.course === '—' ? '' : student.course);
        setCity(student.city === '—' ? '' : student.city);
        setCode(student.code);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not load student.');
        void navigate('/students');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, navigate, studentId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (mode === 'create') {
        await createStudent({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          course: course.trim() || undefined,
          city: city.trim() || undefined,
          password: password || undefined,
          code: code.trim() || undefined,
        });
        toast.success('Student created.');
      } else {
        await updateStudent(studentId, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          course: course.trim() || undefined,
          city: city.trim() || undefined,
          ...(password ? { password } : {}),
        });
        toast.success('Student updated.');
      }
      void navigate('/students');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save student.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading student…</div>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <Button asChild variant="ghost" className="-ml-3 mb-1">
          <Link to="/students">
            <ArrowLeftIcon data-icon="inline-start" /> Back to students
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">
          {mode === 'create' ? 'Add Student' : 'Edit Student'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes are saved to the organization database.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Student information</CardTitle>
          <CardDescription>Required fields must be completed before saving.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="student-name">
                  Full name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="student-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="student-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              {mode === 'create' && (
                <Field>
                  <FieldLabel htmlFor="student-code">Unique ID (optional)</FieldLabel>
                  <Input
                    id="student-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Auto-generated if blank"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="student-phone">Phone</FieldLabel>
                <Input
                  id="student-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-course">Course</FieldLabel>
                <Input
                  id="student-course"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-city">City</FieldLabel>
                <Input id="student-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="student-password">
                  {mode === 'create' ? 'Password (optional)' : 'New password (optional)'}
                </FieldLabel>
                <Input
                  id="student-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => void navigate('/students')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <SaveIcon data-icon="inline-start" />
                  {saving ? 'Saving…' : mode === 'create' ? 'Create student' : 'Save changes'}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
